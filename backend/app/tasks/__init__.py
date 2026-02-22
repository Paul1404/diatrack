from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = BackgroundScheduler()


def start_scheduler():
    """Start the background scheduler for notification checks."""
    from app.tasks.notifications import check_expiring_devices
    
    # Check for expiring devices every 15 minutes
    scheduler.add_job(
        check_expiring_devices,
        trigger=IntervalTrigger(minutes=15),
        id="check_expiring_devices",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
