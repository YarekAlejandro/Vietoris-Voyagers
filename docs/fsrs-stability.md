# Estabilidad del FSRS

Prueba reproducible con 23 corridas curadas que aportan al menos una medida. Para cada perfil se usaron 500 muestras uniformes independientes de los cinco pesos, con perturbaciones de ±20 % antes de renormalizarlos a 100 puntos. Las bonificaciones, los datos y los perfiles de misión permanecieron fijos.

El solapamiento es la fracción del top-5 base que sigue en el conjunto de mayor puntaje tras cada perturbación. La métrica compara pertenencia al conjunto y omite el orden interno. El mínimo es el menor resultado entre las muestras. Este análisis evalúa sensibilidad del ordenamiento a los pesos y tiene alcance únicamente sobre el catálogo curado.

| Perfil | Top base | Solapamiento medio | Mínimo observado | Mismo conjunto |
| --- | --- | ---: | ---: | ---: |
| ISS / Gateway | `BASS-II-GMT45-T4`, `BASS-II-GMT100-T13`, `BASS-II-GMT178-T14`, `BASS-II-GMT175-T10`, `BASS-II-GMT175-T9` | 100.00 % | 100.0 % | 100.0 % |
| Base lunar Artemis | `SAFFIRE-V-E6`, `SAFFIRE-VI-E5`, `SAFFIRE-VI-E6`, `SAFFIRE-VI-E8`, `BASS-II-GMT45-T4` | 100.00 % | 100.0 % | 100.0 % |
| Rover lunar | `SAFFIRE-V-E6`, `SAFFIRE-VI-E5`, `SAFFIRE-VI-E6`, `SAFFIRE-VI-E8`, `BASS-II-GMT45-T4` | 89.20 % | 80.0 % | 46.0 % |
| Traje EVA | `SAFFIRE-VI-E5`, `SAFFIRE-VI-E6`, `SAFFIRE-VI-E8`, `SAFFIRE-V-E6`, `SAFFIRE-IV-1` | 100.00 % | 100.0 % | 100.0 % |
| Minería / Tierra | `SAFFIRE-IV-1`, `SAFFIRE-I-1`, `BASS-II-GMT175-T9`, `BASS-II-GMT45-T4`, `FLEX-40CAL01` | 99.96 % | 80.0 % | 99.8 % |

Regenera este informe con `node scripts/fsrs-stability.ts` desde la raíz del proyecto. [Fórmula del FSRS](fsrs.md)
