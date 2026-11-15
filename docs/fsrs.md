# Similitud con el escenario (FSRS)

El FSRS ordena registros para explorar su pertinencia para un escenario. Los valores de escenario vienen del perfil de misión y sus controles. Las mediciones o los perfiles publicados vienen de los registros y conservan su fuente en el desglose. [Motor FSRS](../src/core/si-engine/fsrs-ranker.ts) · [Perfiles de misión](../src/data/mission_presets.ts)

## Cálculo

Para cada variable, el motor toma el mínimo y el máximo de los valores disponibles. En una corrida puntual los extremos son iguales. La distancia es cero dentro del intervalo y es la distancia al extremo más cercano fuera de él. En estudios con varias corridas, cada eje se resume por separado. Una combinación dentro de esos intervalos puede quedar fuera de la cobertura de las corridas conjuntas.

La semejanza por eje es `s = exp(-0.5 × (distancia / escala)²)`. Un eje sin valor aporta cero. El índice suma las contribuciones y las bonificaciones y limita el total a 100 puntos.

| Criterio | Peso (pts) | Escala |
| --- | ---: | ---: |
| Oxígeno, O₂ | 35 | 12 pp |
| Presión absoluta | 25 | 4 psia |
| Gravedad | 12.5 | 0.25 g |
| Flujo de referencia | 12.5 | 10 cm/s |
| Contexto del estudio | 15 | — |

Los pesos son iguales para ISS / Gateway, Base lunar Artemis, Rover lunar, Traje EVA y Minería / Tierra. Cambian sus valores de escenario y la prioridad. ISS / Gateway y Minería / Tierra priorizan detección. Los perfiles lunares y Traje EVA priorizan prevención.

El contexto suma 40 % de sus 15 puntos por instrumentación aplicable, 35 % por vínculos documentados entre estudios y 25 % cuando el estudio coincide con la prioridad. Un estudio local activa la fracción de instrumentación al tener ficha. Para un estudio importado se requiere información de instrumentación.

El código añade 15 puntos a CFI-G, Saffire IV–V, Saffire VI y BASS-II si el oxígeno del escenario es ≥30 %. Añade 10 puntos a Saffire IV–V y Saffire VI si la presión es ≤10.5 psia. Entre 0.05 y 0.40 g añade 22 puntos a E-FIELD y 10 puntos a BASS-II o SLICE.

**Heurística no calibrada.** Las escalas, los pesos y las bonificaciones anteriores son reglas de ordenamiento sin calibración experimental. Una puntuación de 100 puede resultar del límite de la escala. Para evaluar coincidencia conjunta, consulta **Cobertura del escenario**.

## Lectura de las tarjetas

- **Atm** muestra la suma de los puntos de oxígeno y presión dividida por 60, como porcentaje.
- **Flujo** muestra la semejanza del eje de flujo como porcentaje.
- **Grav/Puente** combina los puntos de gravedad y del contexto divididos por 27.5. Los puntos de contexto pueden generar un porcentaje positivo con gravedad ausente.
- **¿Por qué este puntaje?** muestra el escenario, el valor o rango, la brecha, los puntos por eje, los enlaces de los registros y el desglose de contexto y bonificación. Un porcentaje de 0 puede indicar un eje sin dato o una semejanza positiva que redondea a 0.

Los registros marcados como perfiles nominales PSI quedan fuera de las contribuciones atmosféricas y de la cobertura. Un eje nominal dentro de una corrida también queda fuera de los cálculos de semejanza y cobertura. Los perfiles publicados que contienen cifras pueden aportar al ordenamiento, con procedencia visible. Las cotas experimentales usan corridas medidas.

El análisis reproducible de perturbación de pesos usa las corridas curadas. [Resultados de estabilidad](fsrs-stability.md)
