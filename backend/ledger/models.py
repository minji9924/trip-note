from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("email is required")
        user = self.model(email=email.strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    USERNAME_FIELD = "email"
    objects = UserManager()

    def __str__(self):
        return self.email


class Trip(models.Model):
    name = models.CharField(max_length=100)
    place = models.CharField(max_length=100, blank=True)  # ERD 확장
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=8, default="원")

    def __str__(self):
        return self.name


class TripMember(models.Model):
    OWNER, MEMBER = "owner", "member"
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trip_members")
    role = models.CharField(max_length=10, choices=[(OWNER, "owner"), (MEMBER, "member")], default=MEMBER)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["trip", "user"], name="uniq_trip_user")]


class Person(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="persons")
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name


class Card(models.Model):
    TYPES = ["체크카드", "신용카드", "트래블카드", "현금"]
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="cards")
    owner = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="cards")
    name = models.CharField(max_length=100)
    card_type = models.CharField(max_length=20, choices=[(t, t) for t in TYPES], default="트래블카드")


class Recharge(models.Model):
    # person: 충전한 사람, card: 충전된 카드 (ERD 확장 — 카드별 잔액 계산용)
    person = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="recharges")
    card = models.ForeignKey(Card, null=True, blank=True, on_delete=models.PROTECT, related_name="recharges")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    recharged_at = models.DateField()
    memo = models.CharField(max_length=200, blank=True)


class Expense(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="expenses")
    card = models.ForeignKey(Card, on_delete=models.PROTECT, related_name="expenses")
    description = models.CharField(max_length=200)
    category = models.CharField(max_length=20, default="기타")  # ERD 확장
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    used_at = models.DateTimeField()


class ExpenseShare(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="shares")
    person = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="shares")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
