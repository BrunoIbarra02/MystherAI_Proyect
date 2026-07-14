from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheets', '0018_revision_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='GradioError',
            fields=[
                ('id',        models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('miembro',   models.CharField(blank=True, max_length=100)),
                ('paso',      models.CharField(blank=True, max_length=50)),
                ('modelo',    models.CharField(blank=True, max_length=200)),
                ('mensaje',   models.TextField()),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-timestamp']},
        ),
    ]
