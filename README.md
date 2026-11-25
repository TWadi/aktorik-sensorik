# Aktorik & Sensorik · bewegt erklärt

Actuators and sensors, explained in motion. A free learning site in **German and English** where
every topic starts with an interactive animation: move a slider, watch what happens, then read the
formula.

**Live:** https://twadi.github.io/aktorik-sensorik/

*Aktoren und Sensoren, bewegt erklärt: Jedes Thema beginnt mit einer interaktiven Zeichnung.
Deutsch und Englisch, ohne Anmeldung, ohne Tracking.*

## What is inside

23 sheets in two parts are planned, each with at least one animation and a quick check.

**Status:** A01–A04 and S02 are finished and reviewed. A08, A09 and S03 are drafts. The other sheets
are still being drawn; the site says so when you open one.

| Part A · Aktorik (actuators) | Part S · Sensorik (sensors) |
|---|---|
| A01 Actuator, sensor, control loop | S01 What a sensor must deliver |
| A02 Force and induction | S02 Strain and the Wheatstone bridge |
| A03 The DC motor | S03 Measuring position: pot and LVDT |
| A04 The motor model | S04 Rotary encoders |
| A05 Characteristic, power, efficiency | S05 Acceleration and angular rate |
| A06 H-bridge and current control | S06 Temperature |
| A07 The block diagram | S07 The Hall sensor |
| A08 Transfer function and poles | S08 Measuring light |
| A09 Speed control with PI | S09 Flow |
| A10 Position control | S10 The signal chain |
| A11 The BLDC motor | |
| A12 The stepper motor | |
| A13 Piezo actuators | |

One colour code runs through every drawing: voltage is blue, current orange, speed green,
torque and force violet.

## Run it locally

No build step and no dependencies. You only need Node 20 or newer.

```bash
npm start          # serves the folder at http://localhost:8770
npm test           # physics tests, content rules, animation smoke tests
```

Any static file server works too. The site uses ES modules, so open it through a server, not as a
`file://` page.

## Project structure

```
index.html
css/site.css             design: drafting paper (light) and blueprint (dark)
js/app.js                router: register of sheets, one sheet
js/manifest.js           all sheets: id, title, lead
js/core/                 stage (canvas + controls), drawing toolkit, formula markup, languages, theme
js/physics/              pure, tested model functions (DC motor, control, sensors, …)
js/chapters/a04.js …     one file per sheet: texts in both languages + its animations
tests/                   node:test — physics, content rules, smoke test of every animation
tools/                   local preview server, animation gallery for reviewing
docs/CHAPTER-SPEC.md     how to write a sheet
```

## Contributing

Corrections to the physics, better explanations and new animations are welcome. Read
[docs/CHAPTER-SPEC.md](docs/CHAPTER-SPEC.md) first: it explains the sheet format, the drawing
toolkit and the checks. Every number that appears in a text must be asserted in a test.

## About the content

The texts, examples and drawings were written for this project. The sheets follow the usual topic
order of a university course on actuators and sensors, but this is not official course material
and it is not affiliated with any university. Use it to understand, and check important numbers
yourself.

## License

[MIT](LICENSE)
