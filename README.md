# MTG Tournament Manager — iPad PWA

Versione local-first pensata per iPad. Non richiede Python, Streamlit o un Mac acceso.

## Funzioni incluse
- Anagrafica giocatori
- Creazione tornei
- Round Robin (Bo3) con bye automatico per numero dispari di giocatori
- Swiss con pairing, riduzione rematch e bye
- Inserimento risultati touch-friendly
- Classifica con Match Points, OMW%, GWP%, OGW%
- Storico tornei
- Esportazione CSV della classifica
- Backup/ripristino JSON
- Salvataggio locale sul dispositivo
- Offline dopo l'installazione come web app

## Installazione su iPad
La PWA deve essere pubblicata una volta su un URL HTTPS (per esempio GitHub Pages).

1. Apri l'URL con Safari su iPad.
2. Tocca Condividi.
3. Tocca “Aggiungi alla schermata Home”.
4. Attiva “Apri come app web”.
5. Tocca “Aggiungi”.

Da quel momento MTG Tournament Manager compare come un'app nella schermata Home.

## Dati
I dati vengono salvati nel browser dell'app web sul singolo iPad. Usa periodicamente il pulsante Backup per esportare un file JSON.
