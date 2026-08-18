const camera = document.getElementById("camera");
const cameraMessage = document.getElementById("cameraMessage");
const imageDiv = document.getElementById("imageDiv");
const gatoImagen = document.getElementById("gatoImagen");
const gestureName = document.getElementById("gestureName");
const trackingBadge = document.getElementById("trackingBadge");
const btnCamera = document.getElementById("btnCamera");
const btnStop = document.getElementById("btnStop");
const stage = document.querySelector(".stage");


/* ==========================================================
   IMÁGENES
========================================================== */

const imagenes = [
    "/images/gato1.jpg",
    "/images/gato2.jpg",
    "/images/gato3.jpg",
    "/images/gato4.jpg",
    "/images/gato5.jpg"
];


/* ==========================================================
   ESTADO
========================================================== */

let stream = null;
let holistic = null;

let tracking = false;
let processing = false;

let ultimoGesto = null;
let ultimoCambio = 0;

let candidatoGesto = null;
let framesConfirmacion = 0;

let framesSinGesto = 0;


/*
 * Cuántos frames debe mantenerse el gesto.
 *
 * Lo bajamos de 5 a 3 para que responda más rápido.
 */

const FRAMES_CONFIRMACION = 3;


/*
 * Tiempo mínimo entre cambios.
 */

const COOLDOWN = 400;


/* ==========================================================
   GESTOS
========================================================== */
const gestos = {

    shaka: {
        nombre: "",
        imagen: imagenes[0]
    },

    abierta: {
        nombre: "",
        imagen: imagenes[3]
    },

    indicePulgar: {
        nombre: "",
        imagen: imagenes[2]
    },

    caraLado: {
        nombre: "",
        imagen: imagenes[1]
    },

    puno: {
        nombre: "",
        imagen: imagenes[4]
    }

};

/* ==========================================================
   INICIAR CÁMARA
========================================================== */

async function iniciarTracker() {

    try {

        if (tracking) {
            return;
        }


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "El navegador no permite acceder a la cámara."
            );

        }


        trackingBadge.textContent =
            "🟡 Iniciando detector...";


        stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: "user",

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }

                },

                audio: false

            });


        camera.srcObject = stream;

        await camera.play();


        cameraMessage.classList.add(
            "oculto"
        );


        btnCamera.textContent =
            "📷 Tracker activo";


        tracking = true;


        crearTracker();


        trackingBadge.textContent =
            "🟢 Busca un gesto...";


        iniciarLoop();

    }
    catch (error) {

        console.error(
            "Error iniciando tracker:",
            error
        );


        tracking = false;


        trackingBadge.textContent =
            "🔴 No se pudo iniciar";


        cameraMessage.textContent =
            "No se pudo acceder a la cámara.";


        cameraMessage.classList.remove(
            "oculto"
        );


        alert(
            "No se pudo acceder a la cámara.\n\n" +
            "Acepta el permiso de cámara y vuelve a intentarlo."
        );

    }

}


/* ==========================================================
   MEDIAPIPE HOLISTIC
========================================================== */

function crearTracker() {

    holistic =
        new Holistic({

            locateFile: (file) => {

                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;

            }

        });


    holistic.setOptions({

        modelComplexity: 1,

        refineFaceLandmarks: true,

        minDetectionConfidence: 0.60,

        minTrackingConfidence: 0.60

    });


    holistic.onResults(
        procesarResultado
    );

}


/* ==========================================================
   LOOP
========================================================== */

async function iniciarLoop() {

    while (tracking) {

        if (
            camera.readyState >= 2 &&
            !processing
        ) {

            processing = true;


            try {

                await holistic.send({

                    image: camera

                });

            }
            catch (error) {

                console.error(
                    "Error en tracking:",
                    error
                );

            }


            processing = false;

        }


        await esperar(35);

    }

}


function esperar(ms) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                ms
            );

        }
    );

}


/* ==========================================================
   RESULTADOS
========================================================== */

function procesarResultado(results) {

    if (!tracking) {
        return;
    }


    const cara =
        results.faceLandmarks;


    const manoIzquierda =
        results.leftHandLandmarks;


    const manoDerecha =
        results.rightHandLandmarks;


    /*
    ==========================================================
    PRIMERO BUSCAMOS GESTOS DE MANO
    ==========================================================

    Esto evita que la detección de la cara bloquee
    los gestos de las manos.
    */

    let gestoDetectado = null;

    let manoUsada = null;


    /* ======================================================
       MANO IZQUIERDA
    ====================================================== */

    if (manoIzquierda) {

        const gesto =
            detectarInteraccion(
                manoIzquierda
            );


        if (gesto) {

            gestoDetectado =
                gesto;

            manoUsada =
                manoIzquierda;

        }

    }


    /* ======================================================
       MANO DERECHA
    ====================================================== */

    if (
        !gestoDetectado &&
        manoDerecha
    ) {

        const gesto =
            detectarInteraccion(
                manoDerecha
            );


        if (gesto) {

            gestoDetectado =
                gesto;

            manoUsada =
                manoDerecha;

        }

    }


    /*
    ==========================================================
    SI HAY UN GESTO DE MANO
    ==========================================================

    Los gestos de mano tienen prioridad sobre la cara.
    */

    if (gestoDetectado) {

        framesSinGesto = 0;


        confirmarGesto(
            gestoDetectado,
            manoUsada
        );


        return;

    }


    /*
    ==========================================================
    NO HAY GESTO DE MANO

    Ahora comprobamos GATO 4:
    cara de medio lado.
    ==========================================================
    */

    if (cara) {

        const caraDeLado =
            detectarCaraDeLado(cara);


        if (caraDeLado) {

            framesSinGesto = 0;


            confirmarGesto(
                "caraLado",
                null
            );


            return;

        }

    }


    /*
    ==========================================================
    NO HAY NINGÚN GESTO
    ==========================================================
    */

    candidatoGesto = null;

    framesConfirmacion = 0;

    framesSinGesto++;


    if (
        framesSinGesto > 6
    ) {

        ocultarGato();


        trackingBadge.textContent =
            "🟢 Busca un gesto...";

    }

}


/* ==========================================================
   CONFIRMAR GESTO
========================================================== */

function confirmarGesto(
    gesto,
    landmarks
) {

    /*
     * Si es el mismo gesto seguimos contando.
     */

    if (
        candidatoGesto === gesto
    ) {

        framesConfirmacion++;

    }
    else {

        candidatoGesto =
            gesto;

        framesConfirmacion =
            1;

    }


    /*
     * Todavía no está confirmado.
     */

    if (
        framesConfirmacion <
        FRAMES_CONFIRMACION
    ) {

        trackingBadge.textContent =
            "🟡 Detectando...";

        return;

    }


    /*
     * Gesto confirmado.
     */

    trackingBadge.textContent =
        "🟢 Gesto detectado";


    mostrarGato(
        gesto,
        landmarks
    );

}


/* ==========================================================
   DETECTAR CARA DE MEDIO LADO
========================================================== */

function detectarCaraDeLado(cara) {

    /*
    ==========================================================
    LANDMARKS

    1   = nariz
    33  = esquina ojo izquierdo
    263 = esquina ojo derecho

    Usamos los ojos como referencia porque es más estable
    que utilizar las mejillas.
    ==========================================================
    */

    const nariz =
        cara[1];

    const ojoIzquierdo =
        cara[33];

    const ojoDerecho =
        cara[263];


    if (
        !nariz ||
        !ojoIzquierdo ||
        !ojoDerecho
    ) {

        return false;

    }


    /*
    ==========================================================
    CENTRO DE LOS OJOS
    ==========================================================
    */

    const centroOjosX =
        (
            ojoIzquierdo.x +
            ojoDerecho.x
        ) / 2;


    /*
    ==========================================================
    DISTANCIA ENTRE LOS OJOS
    ==========================================================
    */

    const anchoOjos =
        distancia3D(
            ojoIzquierdo,
            ojoDerecho
        );


    if (
        !anchoOjos ||
        anchoOjos <= 0
    ) {

        return false;

    }


    /*
    ==========================================================
    DESPLAZAMIENTO DE LA NARIZ
    ==========================================================

    Si estás de frente:

            👁️  👃  👁️

    la nariz queda aproximadamente en el centro.

    Si giras:

            👁️ 👃
              👁️

    la nariz se desplaza.
    ==========================================================
    */

    const desplazamiento =
        Math.abs(
            nariz.x -
            centroOjosX
        );


    const desplazamientoRelativo =
        desplazamiento /
        anchoOjos;


    /*
    ==========================================================
    UMBRAL
    ==========================================================

    0.10 = giro pequeño
    0.15 = giro moderado
    0.20 = giro fuerte

    Usamos 0.16.
    ==========================================================
    */

    return (
        desplazamientoRelativo >
        0.16
    );

}


/* ==========================================================
   DETECTAR GESTO DE MANO
========================================================== */

function detectarInteraccion(mano) {

    const forma =
        detectarFormaMano(
            mano
        );


    if (!forma) {
        return null;
    }


    /*
    ==========================================================
    🤙 GATO 1 — SHAKA
    ==========================================================
    */

    if (
        forma === "shaka"
    ) {

        return "shaka";

    }


    /*
    ==========================================================
    🖐️ GATO 2 — MANO ABIERTA

    No necesita cara.
    ==========================================================
    */

    if (
        forma === "abierta"
    ) {

        return "abierta";

    }


    /*
    ==========================================================
    ☝️👍 GATO 3 — ÍNDICE + PULGAR

    No necesita cara.
    ==========================================================
    */

    if (
        forma === "indicePulgar"
    ) {

        return "indicePulgar";

    }


    /*
    ==========================================================
    ✊ GATO 5 — PUÑO

    No necesita cara.
    ==========================================================
    */

    if (
        forma === "puno"
    ) {

        return "puno";

    }

    

    return null;

}


/* ==========================================================
   DETECTAR FORMA DE LA MANO
========================================================== */

function detectarFormaMano(lm) {

    const indice =
        dedoExtendido(
            lm,
            8,
            6,
            5
        );


    const medio =
        dedoExtendido(
            lm,
            12,
            10,
            9
        );


    const anular =
        dedoExtendido(
            lm,
            16,
            14,
            13
        );


    const menique =
        dedoExtendido(
            lm,
            20,
            18,
            17
        );


    const pulgar =
        pulgarExtendido(
            lm
        );


    /*
    ==========================================================
    🤙 SHAKA
    ==========================================================
    */

    if (
        pulgar &&
        !indice &&
        !medio &&
        !anular &&
        menique
    ) {

        return "shaka";

    }


    /*
    ==========================================================
    🖐️ MANO ABIERTA
    ==========================================================
    */

    if (
        pulgar &&
        indice &&
        medio &&
        anular &&
        menique
    ) {

        return "abierta";

    }


    /*
    ==========================================================
    ☝️👍 ÍNDICE + PULGAR
    ==========================================================

    Solo índice y pulgar extendidos.
    */

    if (
        indice &&
        pulgar &&
        !medio &&
        !anular &&
        !menique
    ) {

        const distanciaDedos =
            distancia3D(
                lm[8],
                lm[4]
            );


        const tamanoMano =
            distancia3D(
                lm[0],
                lm[9]
            );


        if (
            tamanoMano > 0
        ) {

            const distanciaRelativa =
                distanciaDedos /
                tamanoMano;


            /*
             * Índice y pulgar separados.
             */

            if (
                distanciaRelativa >= 0.70
            ) {

                return "indicePulgar";

            }

        }

    }


    /*
    ==========================================================
    ✊ PUÑO
    ==========================================================

    Aquí NO usamos simplemente:

        !pulgar &&
        !indice &&
        !medio...

    porque eso falla dependiendo de la orientación
    de la mano.

    En su lugar comprobamos qué tan cerca están
    las puntas de los dedos de la palma.
    ==========================================================
    */

    const indiceCerrado =
        dedoCerrado(
            lm,
            8,
            5
        );


    const medioCerrado =
        dedoCerrado(
            lm,
            12,
            9
        );


    const anularCerrado =
        dedoCerrado(
            lm,
            16,
            13
        );


    const meniqueCerrado =
        dedoCerrado(
            lm,
            20,
            17
        );


    /*
     * Si los cuatro dedos principales están cerrados,
     * consideramos que es un puño.
     *
     * El pulgar NO se utiliza aquí porque puede cambiar
     * bastante dependiendo de si el puño está de frente
     * o de lado.
     */

    if (
        indiceCerrado &&
        medioCerrado &&
        anularCerrado &&
        meniqueCerrado
    ) {

        return "puno";

    }


    return null;

}


function dedoCerrado(
    lm,
    puntaIndex,
    baseIndex
) {

    const punta = lm[puntaIndex];
    const base = lm[baseIndex];
    const muneca = lm[0];

    if (
        !punta ||
        !base ||
        !muneca
    ) {
        return false;
    }

    const puntaMuneca =
        distancia3D(
            punta,
            muneca
        );

    const baseMuneca =
        distancia3D(
            base,
            muneca
        );

    if (
        baseMuneca <= 0
    ) {
        return false;
    }

    /*
     * Más tolerante para móvil.
     */

    return (
        puntaMuneca <
        baseMuneca * 1.70
    );
}

/* ==========================================================
   DETECTAR DEDO EXTENDIDO
========================================================== */

function dedoExtendido(
    lm,
    puntaIndex,
    articulacionIndex,
    mcpIndex
) {

    const punta = lm[puntaIndex];
    const articulacion = lm[articulacionIndex];
    const mcp = lm[mcpIndex];
    const muneca = lm[0];

    if (
        !punta ||
        !articulacion ||
        !mcp ||
        !muneca
    ) {
        return false;
    }

    const puntaMuneca =
        distancia3D(punta, muneca);

    const mcpMuneca =
        distancia3D(mcp, muneca);

    const puntaArticulacion =
        distancia3D(punta, articulacion);

    const articulacionMcp =
        distancia3D(articulacion, mcp);

    if (
        mcpMuneca <= 0 ||
        articulacionMcp <= 0
    ) {
        return false;
    }

    /*
     * Un dedo extendido debe tener la punta
     * claramente más lejos de la muñeca que su MCP.
     */

    const distanciaSuficiente =
        puntaMuneca >
        mcpMuneca * 1.08;

    /*
     * Y debe estar relativamente recto.
     */

    const dedoRecto =
        puntaArticulacion >
        articulacionMcp * 0.65;

    return (
        distanciaSuficiente &&
        dedoRecto
    );
}

/* ==========================================================
   DETECTAR PULGAR
========================================================== */

function pulgarExtendido(lm) {

    const punta = lm[4];
    const base = lm[2];
    const muneca = lm[0];

    if (
        !punta ||
        !base ||
        !muneca
    ) {
        return false;
    }

    const puntaMuneca =
        distancia3D(
            punta,
            muneca
        );

    const baseMuneca =
        distancia3D(
            base,
            muneca
        );

    if (
        baseMuneca <= 0
    ) {
        return false;
    }

    /*
     * El pulgar está extendido.
     */

    return (
        puntaMuneca >
        baseMuneca * 1.08
    );
}

/* ==========================================================
   CALCULAR ÁNGULO
========================================================== */

function calcularAngulo(
    a,
    b,
    c
) {

    const ab = {

        x:
            a.x - b.x,

        y:
            a.y - b.y

    };


    const cb = {

        x:
            c.x - b.x,

        y:
            c.y - b.y

    };


    const producto =
        ab.x * cb.x +
        ab.y * cb.y;


    const magnitudAB =
        Math.sqrt(
            ab.x * ab.x +
            ab.y * ab.y
        );


    const magnitudCB =
        Math.sqrt(
            cb.x * cb.x +
            cb.y * cb.y
        );


    if (
        magnitudAB === 0 ||
        magnitudCB === 0
    ) {

        return 0;

    }


    let coseno =
        producto /
        (
            magnitudAB *
            magnitudCB
        );


    coseno =
        Math.max(
            -1,
            Math.min(
                1,
                coseno
            )
        );


    return (
        Math.acos(coseno) *
        180 /
        Math.PI
    );

}


/* ==========================================================
   DISTANCIA 3D
========================================================== */

function distancia3D(
    a,
    b
) {

    if (
        !a ||
        !b
    ) {

        return Infinity;

    }


    const dx =
        a.x - b.x;


    const dy =
        a.y - b.y;


    const dz =
        (a.z || 0) -
        (b.z || 0);


    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );

}


/* ==========================================================
   MOSTRAR GATO
========================================================== */

function mostrarGato(
    gesto,
    landmarks
) {

    const ahora =
        performance.now();


    if (
        ultimoGesto !== gesto ||
        ahora - ultimoCambio > COOLDOWN
    ) {

        if (
            ultimoGesto !== gesto
        ) {

            gatoImagen.src =
                gestos[gesto].imagen;


            /*
             * NO mostrar texto.
             */

            gestureName.textContent = "";

        }


        ultimoGesto =
            gesto;


        ultimoCambio =
            ahora;

    }


    /*
    ==========================================================
    GESTO DE MANO
    ==========================================================
    */

    if (landmarks) {

        posicionarGato(
            landmarks
        );

    }


    /*
    ==========================================================
    GATO 4 — CARA DE LADO
    ==========================================================
    */

    else {

        posicionarGatoCara();

    }


    imageDiv.classList.remove(
        "oculto"
    );


    imageDiv.classList.add(
        "visible"
    );

}


/* ==========================================================
   POSICIONAR GATO CUANDO ES LA CARA
========================================================== */

function posicionarGatoCara() {

    const ancho =
        stage.clientWidth;


    const alto =
        stage.clientHeight;


    imageDiv.style.left =
        `${ancho * 0.50}px`;


    imageDiv.style.top =
        `${alto * 0.50}px`;

}


/* ==========================================================
   POSICIONAR GATO
========================================================== */

function posicionarGato(
    landmarks
) {

    const puntos = [

        landmarks[0],
        landmarks[5],
        landmarks[9],
        landmarks[13],
        landmarks[17]

    ];


    let x = 0;
    let y = 0;


    for (
        const punto of puntos
    ) {

        x += punto.x;
        y += punto.y;

    }


    x /=
        puntos.length;


    y /=
        puntos.length;


    /*
     * Video espejado.
     */

    const xEspejado =
        1 - x;


    const ancho =
        stage.clientWidth;


    const alto =
        stage.clientHeight;


    const anchoGato =
        imageDiv.offsetWidth ||
        ancho * 0.30;


    const altoGato =
        imageDiv.offsetHeight ||
        ancho * 0.30;


    let left =
        xEspejado *
        ancho;


    let top =
        y *
        alto -
        altoGato * 0.45;


    /*
     * Mantener dentro de la cámara.
     */

    left =
        Math.max(
            anchoGato / 2,
            Math.min(
                ancho -
                anchoGato / 2,
                left
            )
        );


    top =
        Math.max(
            altoGato / 2,
            Math.min(
                alto -
                altoGato / 2,
                top
            )
        );


    imageDiv.style.left =
        `${left}px`;


    imageDiv.style.top =
        `${top}px`;

}


/* ==========================================================
   OCULTAR GATO
========================================================== */

function ocultarGato() {

    imageDiv.classList.remove(
        "visible"
    );


    ultimoGesto =
        null;

}


/* ==========================================================
   DETENER TRACKER
========================================================== */

function detenerTracker() {

    tracking =
        false;


    processing =
        false;


    if (stream) {

        stream
            .getTracks()
            .forEach(
                track => track.stop()
            );


        stream =
            null;

    }


    camera.srcObject =
        null;


    ocultarGato();


    candidatoGesto =
        null;


    framesConfirmacion =
        0;


    framesSinGesto =
        0;


    cameraMessage.textContent =
        'Presiona "Iniciar tracker"';


    cameraMessage.classList.remove(
        "oculto"
    );


    trackingBadge.textContent =
        "Esperando gesto...";


    btnCamera.textContent =
        "📷 Iniciar tracker";

}


/* ==========================================================
   EVENTOS
========================================================== */

btnCamera.addEventListener(
    "click",
    iniciarTracker
);


btnStop.addEventListener(
    "click",
    detenerTracker
);