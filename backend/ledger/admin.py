from django.contrib import admin
from . import models

for m in (models.User, models.Trip, models.TripMember, models.Person, models.Card,
          models.Recharge, models.Expense, models.ExpenseShare):
    admin.site.register(m)
