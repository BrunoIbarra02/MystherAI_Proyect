from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheets', '0017_add_estado_censo_reservado_por'),
    ]

    operations = [
        migrations.AddField(
            model_name='videometadata',
            name='estado_revision',
            field=models.CharField(
                blank=True, null=True,
                choices=[('Pendiente', 'Pendiente'), ('Aprobado', 'Aprobado'), ('Rechazado', 'Rechazado')],
                default='Pendiente', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='videometadata',
            name='comentario_revision',
            field=models.TextField(blank=True, null=True),
        ),
    ]
