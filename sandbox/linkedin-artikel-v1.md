# Cortex-Agentic: Ein Multi-Agenten-System, das nicht nur auf Folien existiert

Die meisten Multi-Agenten-Systeme sehen erstaunlich gut aus, solange niemand sie benutzen muss. `Cortex-Agentic` ist mein Versuch, genau das zu vermeiden: echte Runs, echte Freigaben, echtes Monitoring, ein Dashboard auf dem iPhone und genug Realität, damit aus der Idee kein weiterer KI-Bildschirmschoner wird.

Die Namen der Agenten sind dabei bewusst gewählt. Nicht, weil Personenkult im Maschinenraum eine gute Idee wäre, sondern weil man sich Rollen mit klaren Bildern besser merkt als abstrakte Kürzel.

Claude Debussy ist der Koordinator. Kein Zufall. Debussy ist in dieser Rolle Komponist und Dirigent zugleich: Er schreibt die Partitur, entscheidet, wann wer einsetzt, wer parallel spielt, wer ein Solo verdient und wer aus der Rolle fällt. Michael Angelo ist der Architekt. Der plant, bevor irgendjemand euphorisch anfängt, Wände in tragende Richtungen zu ziehen. Tony Stark baut Prototypen und alles, was nach außen sichtbar wird, ganz bewusst wie im Film. Das ist keine Metapher, das ist Absicht. DINo übernimmt Normen, Recht, Policy und sagt im Zweifel sehr unromantisch: so nicht. Sigmund Freud analysiert, was die anderen übersehen oder nicht fragen würden. Hermes läuft separat im Hintergrund, autonom und eher off im System: Monitoring, Signale, Mails. Auch das gehört zur Wahrheit: Nicht jede Rolle sitzt am selben Pult.

Debussy ist für mich genau deshalb kein Werkzeug und auch kein vollautonomer Agent. Er entscheidet selbst, bis echte Unsicherheit entsteht. Ab da ist Markus die Schnittstelle.

Technisch steht das inzwischen auf eigenen Beinen. Der State liegt in Railway PostgreSQL. Das Dashboard läuft auf Vercel als PWA, inklusive Clerk-Auth, mobil-first und tatsächlich auf dem iPhone nutzbar. Es gibt Run-Listen, Detailansichten, Status, Outputs, Approvals und die Frage, welcher Agent warum gerade etwas tut. Nicht mehr nur Terminalromantik, sondern ein Interface, mit dem man arbeiten kann, ohne vorher fünf CLI-Kommandos auswendig zu lernen.

Dazu kommen Execution Profiles. Das klingt größer, als es ist, löst aber ein sehr praktisches Problem: Nicht jede Aufgabe muss durch alle Agenten laufen. Wenn eine Sache trivial ist, dann darf sie auch trivial behandelt werden. Ein Multi-Agenten-System wird nicht automatisch besser, nur weil man aus Prinzip alle Rollen im Kreis schickt. Keiner braucht eine Beschäftigungstherapie. Bürokratie lässt sich inzwischen auch KI-gestützt bauen. Muss man aber nicht.

Hermes ist der Teil, der nicht dirigiert und auch nicht präsentiert. Er läuft separat als autonomer Backend-Agent, eher off im System. Viele reden über Agenten immer nur im Moment der Ausführung: Prompt rein, Ergebnis raus, nächster Screenshot. Hermes kümmert sich um das, was dazwischen und danach passiert. Monitoring, GitHub-Signale, LinkedIn-Screenshots, Nachtläufe, Mails. Also den Kram, der im Alltag am Ende entscheidet, ob so ein System nur clever klingt oder tatsächlich im Betrieb hilft.

Wichtig ist mir dabei: `Cortex-Agentic` soll kein Mythos von "vollautonomer KI" werden. Der Mensch bleibt drin. Codex implementiert, Markus entscheidet. Ziele, Freigaben, Korrekturen und Stopps sind kein Störfaktor, sondern Teil des Systems. Ich halte das für gesünder als die Erzählung, man müsse Software nur lange genug mit Agenten beschallen, bis sie sich schon selbst verwaltet. Das ist meist der Moment, in dem später jemand mit ernster Miene Logs sortieren darf.

Was heute schon gut funktioniert: der Run-Lifecycle von pending bis completed oder failed, persistente Runs und Events in PostgreSQL, ein mobiles Dashboard mit Auth, Routing über unterschiedliche Ausführungsprofile und Hermes als Monitoring-Schicht im Hintergrund. Das ist echte Arbeit, kein Architekturbild mit vielen Pfeilen und wenig Konsequenz.

Was noch nicht fertig ist, gehört genauso dazu. Die Debussy-Vision ist im Zielbild weiter als im Code an manchen Stellen. Und wie immer gilt: Zwischen "läuft lokal", "läuft auf meinem Handy" und "läuft dauerhaft sauber unter realem Druck" liegen ein paar sehr lehrreiche Unterschiede. Einer davon ist der angenehm unpolierte Moment, in dem auf dem iPhone schon alles sauber aussieht, während man lokal noch kurz denkt, es habe sich gar nichts verändert.

Genau deshalb baue ich das öffentlich genug, dass man den Fortschritt sehen kann, aber konkret genug, dass man sich nicht hinter Schlagwörtern versteckt. Wenn ein Teil noch fehlt, schreibe ich das dazu. Wenn etwas funktioniert, dann weil es implementiert, verdrahtet und getestet wurde. Nicht weil ich fünfmal "agentic" gesagt habe und die Realität höflich mitgespielt hat.

Dieser Artikel wurde, bevor er erschien, von dem Agenten analysiert, den er beschreibt.

Falls du dir das anschauen willst:  
GitHub: https://github.com/Markus-Beermann/cortex-agentic

Ich finde das Thema spannend, weil hier gerade etwas zusammenkommt, das sonst oft getrennt bleibt: saubere Rollen, echte Laufzeit, sichtbares Frontend und ein technischer Unterbau, der nicht beim ersten Realitätskontakt kollabiert. Noch ist nicht alles fertig. Aber genau das ist der Punkt. Es ist nicht Theorie. Es ist im Bau, im Einsatz und an den Stellen ehrlich, an denen es noch nicht fertig ist.
