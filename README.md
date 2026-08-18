# Tracker de gestos + imágenes

Versión web con Node.js + Express + MediaPipe Hands.

## Qué hace

La cámara permanece visible como fondo. Cuando MediaPipe detecta un gesto de la mano, el segundo DIV muestra la imagen correspondiente y lo mueve cerca de la mano.

Gestos:

- 🤙 Shaka → gato1.jpg
- 🖐️ Mano abierta → gato2.jpg
- ☝️ Señalar → gato3.jpg
- ✌️ Dos dedos → gato4.jpg
- ✊ Puño → gato5.jpg

## Ejecutar

```bash
npm install
npm start
```

Abrir:

```text
http://localhost:3000
```

Aceptar el permiso de cámara.

## Importante

MediaPipe Hands se carga desde jsDelivr, por lo que el navegador necesita acceso a Internet para descargar el modelo JavaScript.

La cámara funciona en `localhost` durante desarrollo. En producción, usa HTTPS.

## Personalizar las imágenes

Reemplaza los archivos de:

```text
public/images/
```

manteniendo los nombres `gato1.jpg` hasta `gato5.jpg`, o modifica el arreglo `imagenes` en `public/script.js`.
