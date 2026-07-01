import firebase_admin
from firebase_admin import firestore

_db = None

def get_db():
    global _db
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    if _db is None:
        _db = firestore.client()
    return _db
