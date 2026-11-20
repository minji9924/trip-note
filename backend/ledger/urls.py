from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()
router.register("trips", views.TripViewSet, basename="trip")


def nested(name, viewset):
    base = f"trips/<int:trip_id>/{name}/"
    return [
        path(base, viewset.as_view({"get": "list", "post": "create"})),
        path(base + "<int:pk>/", viewset.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})),
    ]


urlpatterns = [
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/login/", TokenObtainPairView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    *nested("persons", views.PersonViewSet),
    *nested("cards", views.CardViewSet),
    *nested("recharges", views.RechargeViewSet),
    *nested("expenses", views.ExpenseViewSet),
] + router.urls
