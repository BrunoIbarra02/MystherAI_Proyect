from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheets', '0016_remove_videometadata_imagen_arreglo_link_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='videometadata',
            name='estado_censo',
            field=models.CharField(
                blank=True,
                choices=[('Disponible', 'Disponible'), ('Reservado', 'Reservado'), ('Estilizado', 'Estilizado')],
                default='Disponible',
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='videometadata',
            name='reservado_por',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
