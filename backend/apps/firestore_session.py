import datetime
from django.contrib.sessions.backends.base import SessionBase, CreateError
from .firestore_db import get_db


class SessionStore(SessionBase):

    def load(self):
        db = get_db()
        doc = db.collection('sessions').document(self._session_key).get()
        if doc.exists:
            data = doc.to_dict()
            exp = data.get('expire_date')
            if exp and exp > datetime.datetime.now(datetime.timezone.utc):
                return self.decode(data['session_data'])
        self._session_key = None
        return {}

    def exists(self, session_key):
        return get_db().collection('sessions').document(session_key).get().exists

    def create(self):
        while True:
            self._session_key = self._get_new_session_key()
            try:
                self.save(must_create=True)
                return
            except CreateError:
                continue

    def save(self, must_create=False):
        if self.session_key is None:
            return self.create()
        db = get_db()
        ref = db.collection('sessions').document(self.session_key)
        if must_create and ref.get().exists:
            raise CreateError
        expire_date = datetime.datetime.now(datetime.timezone.utc) + \
            datetime.timedelta(seconds=self.get_expiry_age())
        ref.set({
            'session_data': self.encode(self._get_session(no_load=must_create)),
            'expire_date': expire_date,
        })

    def delete(self, session_key=None):
        key = session_key or self.session_key
        if key:
            get_db().collection('sessions').document(key).delete()

    @classmethod
    def clear_expired(cls):
        db = get_db()
        now = datetime.datetime.now(datetime.timezone.utc)
        for doc in db.collection('sessions').where('expire_date', '<', now).stream():
            doc.reference.delete()
