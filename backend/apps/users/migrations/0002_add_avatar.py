from django.db import migrations, models


def add_avatar_if_missing(apps, schema_editor):
    db = schema_editor.connection
    with db.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users_user' AND column_name='avatar'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE users_user ADD COLUMN avatar text NULL")


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_avatar_if_missing, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='user',
                    name='avatar',
                    field=models.TextField(blank=True, null=True),
                ),
            ],
            database_operations=[],
        ),
    ]
