from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Card, Expense, ExpenseShare, Person, Recharge, Trip, User

POSITIVE = {"min_value": Decimal("0.01")}


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, v):
        v = v.strip().lower()
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError("이미 가입된 이메일이에요.")
        return v

    def create(self, vd):
        return User.objects.create_user(**vd)


class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ["id", "name"]


class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = ["id", "name", "owner", "card_type"]

    def validate_owner(self, owner):
        if owner.trip_id != self.context["trip"].id:
            raise serializers.ValidationError("이 여행의 인원이 아니에요.")
        return owner


class RechargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recharge
        fields = ["id", "person", "card", "amount", "recharged_at", "memo"]
        extra_kwargs = {"amount": POSITIVE}

    def validate(self, attrs):
        trip = self.context["trip"]
        if "person" in attrs and attrs["person"].trip_id != trip.id:
            raise serializers.ValidationError({"person": "이 여행의 인원이 아니에요."})
        if attrs.get("card") and attrs["card"].trip_id != trip.id:
            raise serializers.ValidationError({"card": "이 여행의 카드가 아니에요."})
        return attrs


class ExpenseShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseShare
        fields = ["person", "amount"]
        extra_kwargs = {"amount": POSITIVE}


class ExpenseSerializer(serializers.ModelSerializer):
    shares = ExpenseShareSerializer(many=True)

    class Meta:
        model = Expense
        fields = ["id", "card", "description", "category", "total_amount", "used_at", "shares"]
        extra_kwargs = {"total_amount": POSITIVE}

    def validate(self, attrs):
        trip = self.context["trip"]
        if attrs.get("card") and attrs["card"].trip_id != trip.id:
            raise serializers.ValidationError({"card": "이 여행의 카드가 아니에요."})
        shares = attrs.get("shares")
        total = attrs.get("total_amount", getattr(self.instance, "total_amount", None))
        if shares is None and self.instance is not None and "total_amount" in attrs:
            shares = [{"person": s.person, "amount": s.amount} for s in self.instance.shares.all()]
        if shares is not None:
            if not shares:
                raise serializers.ValidationError({"shares": "비용을 부담한 인원이 필요해요."})
            if any(s["person"].trip_id != trip.id for s in shares):
                raise serializers.ValidationError({"shares": "이 여행의 인원이 아니에요."})
            if sum((s["amount"] for s in shares), Decimal("0")) != total:
                raise serializers.ValidationError({"shares": "인원별 부담 금액의 합이 총액과 같아야 해요."})
        return attrs

    @transaction.atomic
    def create(self, vd):
        shares = vd.pop("shares")
        expense = Expense.objects.create(**vd)
        ExpenseShare.objects.bulk_create([ExpenseShare(expense=expense, **s) for s in shares])
        return expense

    @transaction.atomic
    def update(self, inst, vd):
        shares = vd.pop("shares", None)
        for k, v in vd.items():
            setattr(inst, k, v)
        inst.save()
        if shares is not None:
            inst.shares.all().delete()
            ExpenseShare.objects.bulk_create([ExpenseShare(expense=inst, **s) for s in shares])
        return inst


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = ["id", "name", "place", "start_date", "end_date", "currency"]


class TripDetailSerializer(TripSerializer):
    """여행 한 번에 불러오기: 인원, 카드, 충전, 사용 내역(+부담 내역)"""
    persons = PersonSerializer(many=True, read_only=True)
    cards = CardSerializer(many=True, read_only=True)
    recharges = serializers.SerializerMethodField()
    expenses = serializers.SerializerMethodField()

    class Meta(TripSerializer.Meta):
        fields = TripSerializer.Meta.fields + ["persons", "cards", "recharges", "expenses"]

    def get_recharges(self, trip):
        return RechargeSerializer(Recharge.objects.filter(person__trip=trip), many=True).data

    def get_expenses(self, trip):
        return ExpenseSerializer(trip.expenses.prefetch_related("shares"), many=True).data
