from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Recharge, Trip, TripMember, User
from .serializers import (CardSerializer, ExpenseSerializer, PersonSerializer, RechargeSerializer,
                          RegisterSerializer, TripDetailSerializer, TripSerializer)


class Conflict(APIException):
    status_code = 409
    default_detail = "연결된 데이터가 있어 삭제할 수 없어요."


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        t = RefreshToken.for_user(user)
        return Response({"access": str(t.access_token), "refresh": str(t), "email": user.email}, status=201)


class MeView(APIView):
    def get(self, request):
        return Response({"id": request.user.id, "email": request.user.email})


class TripViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Trip.objects.filter(members__user=self.request.user).distinct().order_by("id")

    def get_serializer_class(self):
        return TripDetailSerializer if self.action == "retrieve" else TripSerializer

    def perform_create(self, serializer):
        trip = serializer.save()
        TripMember.objects.create(trip=trip, user=self.request.user, role=TripMember.OWNER)

    def perform_destroy(self, trip):
        if not trip.members.filter(user=self.request.user, role=TripMember.OWNER).exists():
            raise PermissionDenied("여행 삭제는 만든 사람만 할 수 있어요.")
        with transaction.atomic():
            # PROTECT 관계라 참조하는 쪽부터 순서대로 정리
            Recharge.objects.filter(person__trip=trip).delete()
            trip.expenses.all().delete()
            trip.cards.all().delete()
            trip.persons.all().delete()
            trip.delete()

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        trip = self.get_object()
        if request.method == "POST":
            if not trip.members.filter(user=request.user, role=TripMember.OWNER).exists():
                raise PermissionDenied("멤버 초대는 만든 사람만 할 수 있어요.")
            user = User.objects.filter(email=str(request.data.get("email", "")).strip().lower()).first()
            if not user:
                raise NotFound("가입된 사용자가 아니에요. 먼저 회원가입을 안내해 주세요.")
            TripMember.objects.get_or_create(trip=trip, user=user)
        rows = trip.members.select_related("user").order_by("id")
        return Response([{"id": m.id, "email": m.user.email, "role": m.role} for m in rows])


class TripScopedViewSet(viewsets.ModelViewSet):
    """/api/trips/<trip_id>/<resource>/ — 여행 멤버만 접근 가능"""
    permission_classes = [IsAuthenticated]

    def get_trip(self):
        if not hasattr(self, "_trip"):
            qs = Trip.objects.filter(members__user=self.request.user)
            self._trip = get_object_or_404(qs, pk=self.kwargs["trip_id"])
        return self._trip

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "trip": self.get_trip()}

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise Conflict()


class PersonViewSet(TripScopedViewSet):
    serializer_class = PersonSerializer

    def get_queryset(self):
        return self.get_trip().persons.order_by("id")

    def perform_create(self, serializer):
        serializer.save(trip=self.get_trip())


class CardViewSet(TripScopedViewSet):
    serializer_class = CardSerializer

    def get_queryset(self):
        return self.get_trip().cards.order_by("id")

    def perform_create(self, serializer):
        serializer.save(trip=self.get_trip())


class RechargeViewSet(TripScopedViewSet):
    serializer_class = RechargeSerializer

    def get_queryset(self):
        return Recharge.objects.filter(person__trip=self.get_trip()).order_by("-recharged_at", "-id")


class ExpenseViewSet(TripScopedViewSet):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return self.get_trip().expenses.prefetch_related("shares").order_by("-used_at", "-id")

    def perform_create(self, serializer):
        serializer.save(trip=self.get_trip())
