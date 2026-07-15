from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheets', '0019_gradio_error'),
    ]

    operations = [
        migrations.AddField(
            model_name='videometadata',
            name='plano',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='videometadata',
            name='interior',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='videometadata',
            name='accion',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
