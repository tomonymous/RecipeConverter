from django.db import models


class Ingredient(models.Model):
    name = models.CharField(max_length=255)
    quantity = models.FloatField()
    units = models.CharField(max_length=255)
    description = models.CharField(max_length=2083, default='')

