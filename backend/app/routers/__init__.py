from app.routers.auth import router as auth_router
from app.routers.devices import router as devices_router
from app.routers.stats import router as stats_router
from app.routers.admin import router as admin_router

__all__ = ["auth_router", "devices_router", "stats_router", "admin_router"]
