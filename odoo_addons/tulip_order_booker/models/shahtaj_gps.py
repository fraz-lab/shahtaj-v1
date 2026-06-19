# -*- coding: utf-8 -*-
import math

MAX_SHOP_DISTANCE_M = 100.0


def shahtaj_distance_meters(lat1, lon1, lat2, lon2):
    """Haversine distance in metres between two WGS84 points."""
    radius = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))
