(function () {
    'use strict';

    const bufferSize = 1024;
    class AudioPlayer {
        constructor(synthesizer, audioContext) {
            this.synthesizer = synthesizer;
            this.audioContext = audioContext;
            this.started = false;
        }
        start() {
            if (this.started) {
                return;
            }
            this.started = true;
            void this.resumeAudioContext();
            this.synthesizer.reset();
            this.createScriptProcessor();
        }
        stop() {
            if (!this.started) {
                return;
            }
            this.started = false;
            this.releaseScriptProcessor();
        }
        createScriptProcessor() {
            this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            this.scriptProcessor.connect(this.audioContext.destination);
            this.scriptProcessor.addEventListener("audioprocess", (event) => this.audioprocessEventHandler(event));
            this.dummySource = new ConstantSourceNode(this.audioContext);
            this.dummySource.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            this.dummySource.start();
        }
        releaseScriptProcessor() {
            this.dummySource.stop();
            this.scriptProcessor.disconnect();
            this.dummySource.disconnect();
        }
        async resumeAudioContext() {
            if (this.audioContext.state == "suspended") {
                await this.audioContext.resume();
            }
        }
        audioprocessEventHandler(event) {
            const buf = event.outputBuffer.getChannelData(0);
            this.synthesizer.synthesize(buf);
        }
    }

    const palePink = "#FFEEF5";
    class Button {
        constructor(x, y, width, height, text, switchedOn) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.text = text;
            this.switchedOn = switchedOn;
        }
        draw(ctx) {
            const radius = 10;
            ctx.save();
            ctx.strokeStyle = palePink;
            ctx.fillStyle = palePink;
            ctx.globalAlpha = 1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2 * radius;
            ctx.beginPath();
            ctx.moveTo(this.x + radius, this.y + radius);
            ctx.lineTo(this.x + this.width - radius, this.y + radius);
            ctx.lineTo(this.x + this.width - radius, this.y + this.height - radius);
            ctx.lineTo(this.x + radius, this.y + this.height - radius);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            if (this.switchedOn) {
                ctx.fillStyle = "orchid";
                ctx.globalAlpha = 0.6;
            }
            else {
                ctx.fillStyle = "white";
                ctx.globalAlpha = 1;
            }
            this.drawText(ctx);
            ctx.restore();
        }
        drawText(ctx) {
            ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2 + 6);
        }
        handleTouchStart(touch) {
            if (touch.x >= this.x && touch.x <= this.x + this.width && touch.y >= this.y && touch.y <= this.y + this.height) {
                this.switchedOn = !this.switchedOn;
            }
        }
    }
    function mapDomToCanvasCoordinates(canvas, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x1 = clientX - rect.left - (canvas.clientLeft || 0);
        const y1 = clientY - rect.top - (canvas.clientTop || 0);
        const x = x1 / rect.width * canvas.width;
        const y = y1 / rect.height * canvas.height;
        return { x, y };
    }

    function clamp(x, min, max) {
        return (x < min) ? min : (x > max) ? max : x;
    }
    function moveTowards(current, target, amountUp, amountDown) {
        return (current < target) ? Math.min(current + amountUp, target) : Math.max(current - amountDown, target);
    }
    function getTime() {
        return Date.now() / 1000;
    }
    function createBiquadIirFilter(b0, b1, b2, a0, a1, a2) {
        const nb0 = b0 / a0;
        const nb1 = b1 / a0;
        const nb2 = b2 / a0;
        const na1 = a1 / a0;
        const na2 = a2 / a0;
        let x1 = 0;
        let x2 = 0;
        let y1 = 0;
        let y2 = 0;
        return (x) => {
            const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
            x2 = x1;
            x1 = x;
            y2 = y1;
            y1 = y;
            return y;
        };
    }
    function createBandPassFilter(f0, q, sampleRate) {
        const w0 = 2 * Math.PI * f0 / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;
        return createBiquadIirFilter(b0, b1, b2, a0, a1, a2);
    }
    function createBufferedWhiteNoiseSource(bufferSize) {
        const buf = new Float64Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
            buf[i] = 2 * Math.random() - 1;
        }
        let i = 0;
        return () => {
            if (i >= bufferSize) {
                i = 0;
            }
            return buf[i++];
        };
    }
    function createFilteredNoiseSource(f0, q, sampleRate, bufferSize) {
        const whiteNoise = createBufferedWhiteNoiseSource(bufferSize);
        const filter = createBandPassFilter(f0, q, sampleRate);
        return () => filter(whiteNoise());
    }

    const baseNote = 87.3071;
    const marks = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0];
    const keyboardTop = 500;
    const keyboardLeft = 0;
    const keyboardWidth = 600;
    const keyboardHeight = 100;
    const semitones = 20;
    class GlottisUi {
        constructor(glottis) {
            this.pitchControlX = 240;
            this.pitchControlY = 530;
            this.glottis = glottis;
        }
        drawBackground(ctx) {
            ctx.save();
            ctx.strokeStyle = palePink;
            ctx.fillStyle = palePink;
            ctx.globalAlpha = 1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            this.drawBar(ctx, 0, 0.4, 8);
            ctx.globalAlpha = 0.7;
            this.drawBar(ctx, 0.52, 0.72, 8);
            ctx.strokeStyle = "orchid";
            ctx.fillStyle = "orchid";
            for (let i = 0; i < semitones; i++) {
                const keyWidth = keyboardWidth / semitones;
                const x = keyboardLeft + (i + 1 / 2) * keyWidth;
                const y = keyboardTop;
                if (marks[(i + 3) % 12] == 1) {
                    ctx.lineWidth = 4;
                    ctx.globalAlpha = 0.4;
                }
                else {
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 0.2;
                }
                ctx.beginPath();
                ctx.moveTo(x, y + 9);
                ctx.lineTo(x, y + keyboardHeight * 0.4 - 9);
                ctx.stroke();
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                ctx.moveTo(x, y + keyboardHeight * 0.52 + 6);
                ctx.lineTo(x, y + keyboardHeight * 0.72 - 6);
                ctx.stroke();
            }
            ctx.fillStyle = "orchid";
            ctx.font = "17px Arial";
            ctx.textAlign = "center";
            ctx.globalAlpha = 0.7;
            ctx.fillText("voicebox control", 300, 490);
            ctx.fillText("pitch", 300, 592);
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = "orchid";
            ctx.fillStyle = "orchid";
            ctx.save();
            ctx.translate(410, 587);
            this.drawArrow(ctx, 80, 2, 10);
            ctx.translate(-220, 0);
            ctx.rotate(Math.PI);
            this.drawArrow(ctx, 80, 2, 10);
            ctx.restore();
            ctx.restore();
        }
        drawBar(ctx, topFactor, bottomFactor, radius) {
            ctx.lineWidth = radius * 2;
            ctx.beginPath();
            ctx.moveTo(keyboardLeft + radius, keyboardTop + topFactor * keyboardHeight + radius);
            ctx.lineTo(keyboardLeft + keyboardWidth - radius, keyboardTop + topFactor * keyboardHeight + radius);
            ctx.lineTo(keyboardLeft + keyboardWidth - radius, keyboardTop + bottomFactor * keyboardHeight - radius);
            ctx.lineTo(keyboardLeft + radius, keyboardTop + bottomFactor * keyboardHeight - radius);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }
        drawArrow(ctx, l, ahw, ahl) {
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-l, 0);
            ctx.lineTo(0, 0);
            ctx.lineTo(0, -ahw);
            ctx.lineTo(ahl, 0);
            ctx.lineTo(0, ahw);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }
        draw(ctx) {
            this.drawPitchControl(ctx, this.pitchControlX, this.pitchControlY);
        }
        drawPitchControl(ctx, x, y) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const w = 9;
            const h = 15;
            ctx.lineWidth = 4;
            ctx.strokeStyle = "orchid";
            ctx.fillStyle = "orchid";
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(x - w, y - h);
            ctx.lineTo(x + w, y - h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x - w, y + h);
            ctx.closePath();
            ctx.stroke();
            ctx.globalAlpha = 0.15;
            ctx.fill();
            ctx.restore();
        }
        handleTouches(touches) {
            const glottis = this.glottis;
            if (this.touch && !this.touch.alive) {
                this.touch = undefined;
            }
            if (!this.touch) {
                for (const touch of touches) {
                    if (!touch.alive) {
                        continue;
                    }
                    if (touch.y < keyboardTop) {
                        continue;
                    }
                    this.touch = touch;
                }
            }
            if (this.touch) {
                const localX = this.touch.x - keyboardLeft;
                const localY = clamp(this.touch.y - keyboardTop - 10, 0, keyboardHeight - 26);
                const semitone = semitones * localX / keyboardWidth + 0.5;
                glottis.targetFrequency = baseNote * Math.pow(2, semitone / 12);
                const t = clamp(1 - localY / (keyboardHeight - 28), 0, 1);
                glottis.targetTenseness = 1 - Math.cos(t * Math.PI / 2);
                this.pitchControlX = this.touch.x;
                this.pitchControlY = localY + keyboardTop + 10;
            }
            glottis.isTouched = !!this.touch;
        }
    }

    const originX = 340;
    const originY = 449;
    const radius = 298;
    const scale = 60;
    const fillColour = 'pink';
    const lineColour = '#C070C6';
    const angleScale = 0.64;
    const angleOffset = -0.24;
    const noseOffset = 0.8;
    const innerTongueControlRadius = 2.05;
    const outerTongueControlRadius = 3.5;
    class TractUi {
        constructor(tract, tractShaper) {
            this.guiWobbleTime = 0;
            this.tract = tract;
            this.tractShaper = tractShaper;
            this.tongueLowerIndexBound = tract.bladeStart + 2;
            this.tongueUpperIndexBound = tract.tipStart - 3;
            this.tongueIndexCentre = 0.5 * (this.tongueLowerIndexBound + this.tongueUpperIndexBound);
        }
        getPolar(i, d, doWobble = false) {
            let angle = angleOffset + i * angleScale * Math.PI / (this.tract.lipStart - 1);
            let r = radius - scale * d;
            if (doWobble) {
                const wobble = this.getWobble(i);
                angle += wobble;
                r += 100 * wobble;
            }
            return { angle, r };
        }
        getWobble(i) {
            const tract = this.tract;
            return (tract.maxAmplitude[tract.n - 1] + tract.noseMaxAmplitude[tract.noseLength - 1]) * 0.03 * Math.sin(2 * i - 50 * this.guiWobbleTime) * i / tract.n;
        }
        moveTo(i, d) {
            const p = this.getPolar(i, d, true);
            this.ctx.moveTo(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle));
        }
        lineTo(i, d) {
            const p = this.getPolar(i, d, true);
            this.ctx.lineTo(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle));
        }
        drawText(i, d, text) {
            const ctx = this.ctx;
            const p = this.getPolar(i, d);
            ctx.save();
            ctx.translate(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle) + 2);
            ctx.rotate(p.angle - Math.PI / 2);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
        drawTextStraight(i, d, text) {
            const ctx = this.ctx;
            const p = this.getPolar(i, d);
            ctx.save();
            ctx.translate(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle) + 2);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
        drawCircle(i, d, circleRadius) {
            const ctx = this.ctx;
            const p = this.getPolar(i, d);
            ctx.beginPath();
            ctx.arc(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle), circleRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
        getIndex(x, y) {
            const xx = x - originX;
            const yy = y - originY;
            let angle = Math.atan2(yy, xx);
            while (angle > 0) {
                angle -= 2 * Math.PI;
            }
            return (Math.PI + angle - angleOffset) * (this.tract.lipStart - 1) / (angleScale * Math.PI);
        }
        getDiameter(x, y) {
            const xx = x - originX;
            const yy = y - originY;
            return (radius - Math.sqrt(xx * xx + yy * yy)) / scale;
        }
        draw(ctx) {
            this.ctx = ctx;
            const tract = this.tract;
            this.guiWobbleTime = getTime();
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            this.drawTongueControl();
            const velum = tract.noseDiameter[0];
            const velumAngle = velum * 4;
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = fillColour;
            ctx.fillStyle = fillColour;
            this.moveTo(1, 0);
            for (let i = 1; i < tract.n; i++) {
                this.lineTo(i, tract.diameter[i]);
            }
            for (let i = tract.n - 1; i >= 2; i--) {
                this.lineTo(i, 0);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = fillColour;
            ctx.fillStyle = fillColour;
            this.moveTo(tract.noseStart, -noseOffset);
            for (let i = 1; i < tract.noseLength; i++) {
                this.lineTo(i + tract.noseStart, -noseOffset - tract.noseDiameter[i] * 0.9);
            }
            for (let i = tract.noseLength - 1; i >= 1; i--) {
                this.lineTo(i + tract.noseStart, -noseOffset);
            }
            ctx.closePath();
            this.ctx.fill();
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = fillColour;
            ctx.fillStyle = fillColour;
            this.moveTo(tract.noseStart - 2, 0);
            this.lineTo(tract.noseStart, -noseOffset);
            this.lineTo(tract.noseStart + velumAngle, -noseOffset);
            this.lineTo(tract.noseStart + velumAngle - 2, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.font = "20px Arial";
            ctx.textAlign = "center";
            ctx.globalAlpha = 1;
            this.drawText(tract.n * 0.10, 0.425, "throat");
            this.drawText(tract.n * 0.71, -1.8, "nasal");
            this.drawText(tract.n * 0.71, -1.3, "cavity");
            ctx.font = "22px Arial";
            this.drawText(tract.n * 0.6, 0.9, "oral");
            this.drawText(tract.n * 0.7, 0.9, "cavity");
            this.drawAmplitudes();
            ctx.beginPath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = lineColour;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            this.moveTo(1, tract.diameter[0]);
            for (let i = 2; i < tract.n; i++) {
                this.lineTo(i, tract.diameter[i]);
            }
            this.moveTo(1, 0);
            for (let i = 2; i <= tract.noseStart - 2; i++) {
                this.lineTo(i, 0);
            }
            this.moveTo(tract.noseStart + velumAngle - 2, 0);
            for (let i = tract.noseStart + Math.ceil(velumAngle) - 2; i < tract.n; i++) {
                this.lineTo(i, 0);
            }
            ctx.stroke();
            ctx.beginPath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = lineColour;
            ctx.lineJoin = 'round';
            this.moveTo(tract.noseStart, -noseOffset);
            for (let i = 1; i < tract.noseLength; i++) {
                this.lineTo(i + tract.noseStart, -noseOffset - tract.noseDiameter[i] * 0.9);
            }
            this.moveTo(tract.noseStart + velumAngle, -noseOffset);
            for (let i = Math.ceil(velumAngle); i < tract.noseLength; i++) {
                this.lineTo(i + tract.noseStart, -noseOffset);
            }
            ctx.stroke();
            ctx.globalAlpha = velum * 5;
            ctx.beginPath();
            this.moveTo(tract.noseStart - 2, 0);
            this.lineTo(tract.noseStart, -noseOffset);
            this.moveTo(tract.noseStart + velumAngle - 2, 0);
            this.lineTo(tract.noseStart + velumAngle, -noseOffset);
            ctx.stroke();
            ctx.fillStyle = "orchid";
            ctx.font = "20px Arial";
            ctx.textAlign = "center";
            ctx.globalAlpha = 0.7;
            this.drawText(tract.n * 0.95, 0.8 + 0.8 * tract.diameter[tract.n - 1], " lip");
            ctx.restore();
        }
        drawBackground(ctx) {
            this.ctx = ctx;
            const tract = this.tract;
            ctx.save();
            ctx.fillStyle = "orchid";
            ctx.font = "20px Arial";
            ctx.textAlign = "center";
            ctx.globalAlpha = 0.7;
            this.drawText(tract.n * 0.44, -0.28, "soft");
            this.drawText(tract.n * 0.51, -0.28, "palate");
            this.drawText(tract.n * 0.77, -0.28, "hard");
            this.drawText(tract.n * 0.84, -0.28, "palate");
            this.drawText(tract.n * 0.95, -0.28, " lip");
            ctx.font = "17px Arial";
            this.drawTextStraight(tract.n * 0.18, 3, "  tongue control");
            ctx.textAlign = "left";
            this.drawText(tract.n * 1.03, -1.07, "nasals");
            this.drawText(tract.n * 1.03, -0.28, "stops");
            this.drawText(tract.n * 1.03, 0.51, "fricatives");
            ctx.strokeStyle = "orchid";
            ctx.lineWidth = 2;
            ctx.beginPath();
            this.moveTo(tract.n * 1.03, 0);
            this.lineTo(tract.n * 1.07, 0);
            this.moveTo(tract.n * 1.03, -noseOffset);
            this.lineTo(tract.n * 1.07, -noseOffset);
            ctx.stroke();
            ctx.restore();
        }
        drawAmplitudes() {
            const ctx = this.ctx;
            const tract = this.tract;
            ctx.strokeStyle = "orchid";
            ctx.lineCap = "butt";
            ctx.globalAlpha = 0.3;
            for (let i = 2; i < tract.n - 1; i++) {
                ctx.beginPath();
                ctx.lineWidth = Math.sqrt(tract.maxAmplitude[i]) * 3;
                this.moveTo(i, 0);
                this.lineTo(i, tract.diameter[i]);
                ctx.stroke();
            }
            for (let i = 1; i < tract.noseLength - 1; i++) {
                ctx.beginPath();
                ctx.lineWidth = Math.sqrt(tract.noseMaxAmplitude[i]) * 3;
                this.moveTo(i + tract.noseStart, -noseOffset);
                this.lineTo(i + tract.noseStart, -noseOffset - tract.noseDiameter[i] * 0.9);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        drawTongueControl() {
            const ctx = this.ctx;
            const tract = this.tract;
            const tractShaper = this.tractShaper;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = palePink;
            ctx.fillStyle = palePink;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.lineWidth = 45;
            this.moveTo(this.tongueLowerIndexBound, innerTongueControlRadius);
            for (let i = this.tongueLowerIndexBound + 1; i <= this.tongueUpperIndexBound; i++) {
                this.lineTo(i, innerTongueControlRadius);
            }
            this.lineTo(this.tongueIndexCentre, outerTongueControlRadius);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            {
                const a = innerTongueControlRadius;
                const c = outerTongueControlRadius;
                const b = 0.5 * (a + c);
                const r = 3;
                ctx.fillStyle = "orchid";
                ctx.globalAlpha = 0.3;
                this.drawCircle(this.tongueIndexCentre, a, r);
                this.drawCircle(this.tongueIndexCentre - 4.25, a, r);
                this.drawCircle(this.tongueIndexCentre - 8.5, a, r);
                this.drawCircle(this.tongueIndexCentre + 4.25, a, r);
                this.drawCircle(this.tongueIndexCentre + 8.5, a, r);
                this.drawCircle(this.tongueIndexCentre - 6.1, b, r);
                this.drawCircle(this.tongueIndexCentre + 6.1, b, r);
                this.drawCircle(this.tongueIndexCentre, b, r);
                this.drawCircle(this.tongueIndexCentre, c, r);
            }
            ctx.globalAlpha = 1;
            {
                const angle = angleOffset + tractShaper.tongueIndex * angleScale * Math.PI / (tract.lipStart - 1);
                const r = radius - scale * tractShaper.tongueDiameter;
                const x = originX - r * Math.cos(angle);
                const y = originY - r * Math.sin(angle);
                ctx.lineWidth = 4;
                ctx.strokeStyle = "orchid";
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.arc(x, y, 18, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.globalAlpha = 0.15;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = "orchid";
        }
        handleTouches(touches, time) {
            const tract = this.tract;
            const tractShaper = this.tractShaper;
            this.handleTongueTouch(touches, time);
            tract.turbulencePoints = this.generateTurbulencePoints(touches);
            for (let i = 0; i < tract.n; i++) {
                tractShaper.targetDiameter[i] = tractShaper.getRestDiameter(i);
            }
            let velumOpen = false;
            for (const touch of touches) {
                if (!touch.alive) {
                    continue;
                }
                const x = touch.x;
                const y = touch.y;
                const index = this.getIndex(x, y);
                const diameter1 = this.getDiameter(x, y);
                if (index > tract.noseStart && diameter1 < -noseOffset) {
                    velumOpen = true;
                }
                if (diameter1 < -0.85 - noseOffset) {
                    continue;
                }
                const diameter2 = Math.max(0, diameter1 - 0.3);
                this.reduceTargetDiametersByTouch(index, diameter2);
            }
            tractShaper.velumTarget = velumOpen ? tractShaper.velumOpenTarget : tractShaper.velumClosedTarget;
        }
        reduceTargetDiametersByTouch(index, diameter) {
            const tract = this.tract;
            const tractShaper = this.tractShaper;
            if (index < 2 || index >= tract.n || diameter >= 3) {
                return;
            }
            let width;
            if (index < 25) {
                width = 10;
            }
            else if (index >= tract.tipStart) {
                width = 5;
            }
            else {
                width = 10 - 5 * (index - 25) / (tract.tipStart - 25);
            }
            for (let i = -Math.ceil(width) - 1; i < width + 1; i++) {
                const p = Math.round(index) + i;
                if (p < 0 || p >= tract.n) {
                    continue;
                }
                const relpos = Math.abs(p - index) - 0.5;
                let shrink;
                if (relpos <= 0) {
                    shrink = 0;
                }
                else if (relpos > width) {
                    shrink = 1;
                }
                else {
                    shrink = 0.5 * (1 - Math.cos(Math.PI * relpos / width));
                }
                if (diameter < tractShaper.targetDiameter[p]) {
                    tractShaper.targetDiameter[p] = diameter + (tractShaper.targetDiameter[p] - diameter) * shrink;
                }
            }
        }
        generateTurbulencePoints(touches) {
            const a = [];
            for (const touch of touches) {
                const p = {
                    position: touch.index,
                    diameter: touch.diameter,
                    startTime: touch.startTime,
                    endTime: touch.alive ? NaN : touch.endTime
                };
                a.push(p);
            }
            return a;
        }
        handleTongueTouch(touches, time) {
            const tractShaper = this.tractShaper;
            if (this.tongueTouch && !this.tongueTouch.alive) {
                this.tongueTouch = undefined;
            }
            if (!this.tongueTouch) {
                for (const touch of touches) {
                    if (!touch.alive) {
                        continue;
                    }
                    if (time - touch.startTime > 0.1) {
                        continue;
                    }
                    const x = touch.x;
                    const y = touch.y;
                    const index = this.getIndex(x, y);
                    const diameter = this.getDiameter(x, y);
                    if (index >= this.tongueLowerIndexBound - 4 && index <= this.tongueUpperIndexBound + 4 &&
                        diameter >= innerTongueControlRadius - 0.5 && diameter <= outerTongueControlRadius + 0.5) {
                        this.tongueTouch = touch;
                    }
                }
            }
            if (this.tongueTouch) {
                const x = this.tongueTouch.x;
                const y = this.tongueTouch.y;
                const index = this.getIndex(x, y);
                const diameter = this.getDiameter(x, y);
                let fromPoint = (outerTongueControlRadius - diameter) / (outerTongueControlRadius - innerTongueControlRadius);
                fromPoint = clamp(fromPoint, 0, 1);
                fromPoint = Math.pow(fromPoint, 0.58) - 0.2 * (fromPoint * fromPoint - fromPoint);
                tractShaper.tongueDiameter = clamp(diameter, innerTongueControlRadius, outerTongueControlRadius);
                const out = fromPoint * 0.5 * (this.tongueUpperIndexBound - this.tongueLowerIndexBound);
                tractShaper.tongueIndex = clamp(index, this.tongueIndexCentre - out, this.tongueIndexCentre + out);
            }
        }
    }

    const projectUrl = "github.com/chdh/pink-trombone-mod";
    class MainUi extends EventTarget {
        constructor(synthesizer, canvas) {
            super();
            this.mouseTouchCtr = 0;
            this.synthesizer = synthesizer;
            this.canvas = canvas;
            this.ctx = canvas.getContext("2d");
            this.glottis = synthesizer.glottis;
            this.glottisUi = new GlottisUi(synthesizer.glottis);
            this.tractUi = new TractUi(synthesizer.tract, synthesizer.tractShaper);
            this.touchesWithMouse = [];
            this.screen = 2;
            this.aboutButton = new Button(460, 392, 140, 30, "about...", true);
            this.alwaysVoiceButton = new Button(460, 428, 140, 30, "always voice", true);
            this.autoWobbleButton = new Button(460, 464, 140, 30, "pitch wobble", true);
            canvas.addEventListener("touchstart", (event) => this.touchStartEventHandler(event));
            canvas.addEventListener("touchmove", (event) => this.touchMoveEventHandler(event));
            canvas.addEventListener("touchend", (event) => this.touchEndEventHandler(event));
            canvas.addEventListener("touchcancel", (event) => this.touchEndEventHandler(event));
            canvas.addEventListener("mousedown", (event) => this.mouseDownEventHandler(event));
            document.addEventListener("mouseup", (event) => this.mouseUpEventHandler(event));
            document.addEventListener("mousemove", (event) => this.mouseMoveEventHandler(event));
            this.createBackgroundCanvas();
        }
        createBackgroundCanvas() {
            this.backCanvas = document.createElement("canvas");
            this.backCanvas.width = this.canvas.width;
            this.backCanvas.height = this.canvas.height;
            const ctx = this.backCanvas.getContext("2d");
            this.glottisUi.drawBackground(ctx);
            this.tractUi.drawBackground(ctx);
        }
        getTractTime() {
            return this.synthesizer.tract.time;
        }
        switchScreen(screen) {
            this.screen = screen;
            this.aboutButton.switchedOn = true;
            this.dispatchEvent(new CustomEvent("screen-switched"));
        }
        draw() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.drawImage(this.backCanvas, 0, 0);
            this.glottisUi.draw(ctx);
            this.tractUi.draw(ctx);
            this.alwaysVoiceButton.draw(ctx);
            this.autoWobbleButton.draw(ctx);
            this.aboutButton.draw(ctx);
            switch (this.screen) {
                case 2: {
                    this.drawAboutScreen();
                    break;
                }
                case 1: {
                    this.drawInstructionsScreen();
                    break;
                }
            }
        }
        drawAboutScreen() {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = "white";
            ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fill();
            ctx.restore();
            this.drawAboutText();
        }
        drawAboutText() {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#C070C6";
            ctx.strokeStyle = "#C070C6";
            ctx.font = "50px Arial";
            ctx.lineWidth = 3;
            ctx.textAlign = "center";
            const titleText = "P i n k   T r o m b o n e";
            ctx.strokeText(titleText, 300, 230);
            ctx.fillText(titleText, 300, 230);
            ctx.font = "28px Arial";
            ctx.fillText("bare-handed  speech synthesis", 300, 330);
            ctx.font = "20px Arial";
            ctx.restore();
        }
        drawInstructionsScreen() {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = "white";
            ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#C070C6";
            ctx.strokeStyle = "#C070C6";
            ctx.font = "24px Arial";
            ctx.lineWidth = 2;
            ctx.textAlign = "center";
            ctx.font = "19px Arial";
            ctx.textAlign = "left";
            this.instructionsLine = 0;
            this.write("Sound is generated in the glottis (at the bottom left) then ");
            this.write("filtered by the shape of the vocal tract. The voicebox ");
            this.write("controls the pitch and intensity of the initial sound.");
            this.write("");
            this.write("Then, to talk:");
            this.write("");
            this.write("- move the body of the tongue to shape vowels");
            this.write("");
            this.write("- touch the oral cavity to narrow it, for fricative consonants");
            this.write("");
            this.write("- touch above the oral cavity to close it, for stop consonants");
            this.write("");
            this.write("- touch the nasal cavity to open the velum and let sound ");
            this.write("   flow through the nose.");
            this.write("");
            this.write("");
            this.write("(tap anywhere to continue)");
            this.instructionsLine = 18.8;
            ctx.textAlign = "left";
            this.write("This is the demo program for the pink-trombone-mod package.");
            ctx.save();
            ctx.fillStyle = "blue";
            ctx.globalAlpha = 0.6;
            this.write(projectUrl);
            ctx.restore();
            this.write("Pink Trombone was developed by Neil Thapen in 2017.");
            ctx.restore();
        }
        instructionsScreenHandleTouches(touches) {
            for (const touch of touches) {
                const p = mapDomToCanvasCoordinates(this.canvas, touch.clientX, touch.clientY);
                this.instructionsScreenHandleTouch(p.x, p.y);
            }
        }
        instructionsScreenHandleTouch(x, y) {
            if ((x >= 35 && x <= 400) && (y >= 515 && y <= 540)) {
                window.location.href = "https://" + projectUrl;
            }
            else {
                this.switchScreen(0);
            }
        }
        write(text) {
            this.ctx.fillText(text, 50, 100 + this.instructionsLine * 22);
            this.instructionsLine += (text == "") ? 0.7 : 1;
        }
        buttonsHandleTouchStart(touch) {
            this.alwaysVoiceButton.handleTouchStart(touch);
            this.glottis.alwaysVoice = this.alwaysVoiceButton.switchedOn;
            this.autoWobbleButton.handleTouchStart(touch);
            this.glottis.autoWobble = this.autoWobbleButton.switchedOn;
            this.aboutButton.handleTouchStart(touch);
        }
        touchStartEventHandler(event) {
            event.preventDefault();
            switch (this.screen) {
                case 0: {
                    this.processStartTouches(event.changedTouches);
                    this.handleTouches();
                    break;
                }
                case 2: {
                    this.switchScreen(0);
                    break;
                }
                case 1: {
                    this.instructionsScreenHandleTouches(event.changedTouches);
                    break;
                }
            }
        }
        processStartTouches(touches) {
            for (const touch of touches) {
                const appTouch = {};
                appTouch.startTime = this.getTractTime();
                appTouch.endTime = 0;
                appTouch.alive = true;
                appTouch.id = touch.identifier;
                this.updateAppTouchPosition(appTouch, touch.clientX, touch.clientY);
                this.touchesWithMouse.push(appTouch);
                this.buttonsHandleTouchStart(appTouch);
            }
        }
        updateAppTouchPosition(appTouch, clientX, clientY) {
            const p = mapDomToCanvasCoordinates(this.canvas, clientX, clientY);
            appTouch.x = p.x;
            appTouch.y = p.y;
            appTouch.index = this.tractUi.getIndex(p.x, p.y);
            appTouch.diameter = this.tractUi.getDiameter(p.x, p.y);
        }
        getAppTouchById(id) {
            for (const appTouch of this.touchesWithMouse) {
                if (appTouch.id == id && appTouch.alive) {
                    return appTouch;
                }
            }
            return undefined;
        }
        touchMoveEventHandler(event) {
            for (const touch of event.changedTouches) {
                const appTouch = this.getAppTouchById(touch.identifier);
                if (appTouch) {
                    this.updateAppTouchPosition(appTouch, touch.clientX, touch.clientY);
                }
            }
            this.handleTouches();
        }
        touchEndEventHandler(event) {
            for (const touch of event.changedTouches) {
                const appTouch = this.getAppTouchById(touch.identifier);
                if (appTouch) {
                    appTouch.alive = false;
                    appTouch.endTime = this.getTractTime();
                }
            }
            this.handleTouches();
            if (this.screen == 0 && !this.aboutButton.switchedOn) {
                this.switchScreen(1);
            }
        }
        mouseDownEventHandler(event) {
            event.preventDefault();
            switch (this.screen) {
                case 0: {
                    const appTouch = {};
                    appTouch.startTime = this.getTractTime();
                    appTouch.endTime = 0;
                    appTouch.alive = true;
                    appTouch.id = "mouse" + this.mouseTouchCtr++;
                    this.updateAppTouchPosition(appTouch, event.clientX, event.clientY);
                    this.mouseTouch = appTouch;
                    this.touchesWithMouse.push(appTouch);
                    this.buttonsHandleTouchStart(appTouch);
                    this.handleTouches();
                    break;
                }
                case 2: {
                    this.switchScreen(0);
                    break;
                }
                case 1: {
                    const p = mapDomToCanvasCoordinates(this.canvas, event.clientX, event.clientY);
                    this.instructionsScreenHandleTouch(p.x, p.y);
                    break;
                }
            }
        }
        mouseMoveEventHandler(event) {
            const appTouch = this.mouseTouch;
            if (!appTouch || !appTouch.alive) {
                return;
            }
            this.updateAppTouchPosition(appTouch, event.clientX, event.clientY);
            this.handleTouches();
        }
        mouseUpEventHandler(_event) {
            const appTouch = this.mouseTouch;
            if (!appTouch || !appTouch.alive) {
                return;
            }
            appTouch.alive = false;
            appTouch.endTime = this.getTractTime();
            this.handleTouches();
            if (this.screen == 0 && !this.aboutButton.switchedOn) {
                this.switchScreen(1);
            }
        }
        handleTouches() {
            this.removeOldTouches();
            if (this.screen == 0) {
                this.tractUi.handleTouches(this.touchesWithMouse, this.getTractTime());
                this.glottisUi.handleTouches(this.touchesWithMouse);
            }
        }
        removeOldTouches() {
            const time = this.getTractTime();
            for (let i = this.touchesWithMouse.length - 1; i >= 0; i--) {
                const appTouch = this.touchesWithMouse[i];
                if (!appTouch.alive && time > appTouch.endTime + 1) {
                    this.touchesWithMouse.splice(i, 1);
                }
            }
        }
    }

    class Grad {
        constructor(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        dot2(x, y) {
            return this.x * x + this.y * y;
        }
        dot3(x, y, z) {
            return this.x * x + this.y * y + this.z * z;
        }
    }
    const grad3 = [
        new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
        new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
        new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1)
    ];
    const p = [
        151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36,
        103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0,
        26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56,
        87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77,
        146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245,
        40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89,
        18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
        52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206,
        59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
        154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108,
        110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193,
        238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192,
        214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138,
        236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
    ];
    const perm = new Array(512);
    const gradP = new Array(512);
    function setSeed(seed0) {
        let seed = seed0;
        if (seed > 0 && seed < 1) {
            seed *= 65536;
        }
        seed = Math.floor(seed);
        if (seed < 256) {
            seed |= seed << 8;
        }
        for (var i = 0; i < 256; i++) {
            var v;
            if (i & 1) {
                v = p[i] ^ (seed & 255);
            }
            else {
                v = p[i] ^ ((seed >> 8) & 255);
            }
            perm[i] = perm[i + 256] = v;
            gradP[i] = gradP[i + 256] = grad3[v % 12];
        }
    }
    setSeed(Date.now());
    const f2 = 0.5 * (Math.sqrt(3) - 1);
    const g2 = (3 - Math.sqrt(3)) / 6;
    function simplex2(xin, yin) {
        var n0, n1, n2;
        const s = (xin + yin) * f2;
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        const t = (i + j) * g2;
        const x0 = xin - i + t;
        const y0 = yin - j + t;
        let i1, j1;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        }
        else {
            i1 = 0;
            j1 = 1;
        }
        const x1 = x0 - i1 + g2;
        const y1 = y0 - j1 + g2;
        const x2 = x0 - 1 + 2 * g2;
        const y2 = y0 - 1 + 2 * g2;
        i &= 255;
        j &= 255;
        const gi0 = gradP[i + perm[j]];
        const gi1 = gradP[i + i1 + perm[j + j1]];
        const gi2 = gradP[i + 1 + perm[j + 1]];
        var t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0;
        }
        else {
            t0 *= t0;
            n0 = t0 * t0 * gi0.dot2(x0, y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0;
        }
        else {
            t1 *= t1;
            n1 = t1 * t1 * gi1.dot2(x1, y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0;
        }
        else {
            t2 *= t2;
            n2 = t2 * t2 * gi2.dot2(x2, y2);
        }
        return 70 * (n0 + n1 + n2);
    }
    function simplex1(x) {
        return simplex2(x * 1.2, -x * 0.7);
    }

    class Glottis {
        constructor(sampleRate) {
            this.alwaysVoice = true;
            this.autoWobble = true;
            this.isTouched = false;
            this.targetTenseness = 0.6;
            this.targetFrequency = 140;
            this.vibratoAmount = 0.005;
            this.vibratoFrequency = 6;
            this.sampleCount = 0;
            this.intensity = 0;
            this.loudness = 1;
            this.smoothFrequency = 140;
            this.timeInWaveform = 0;
            this.newTenseness = 0.6;
            this.oldTenseness = 0.6;
            this.newFrequency = 140;
            this.oldFrequency = 140;
            this.sampleRate = sampleRate;
            this.aspirationNoiseSource = createFilteredNoiseSource(500, 0.5, sampleRate, 0x8000);
            this.setupWaveform(0);
        }
        step(lambda) {
            const time = this.sampleCount / this.sampleRate;
            if (this.timeInWaveform > this.waveformLength) {
                this.timeInWaveform -= this.waveformLength;
                this.setupWaveform(lambda);
            }
            const out1 = this.normalizedLFWaveform(this.timeInWaveform / this.waveformLength);
            const aspirationNoise = this.aspirationNoiseSource();
            const aspiration1 = this.intensity * (1 - Math.sqrt(this.targetTenseness)) * this.getNoiseModulator() * aspirationNoise;
            const aspiration2 = aspiration1 * (0.2 + 0.02 * simplex1(time * 1.99));
            const out = out1 + aspiration2;
            this.sampleCount++;
            this.timeInWaveform += 1 / this.sampleRate;
            return out;
        }
        getNoiseModulator() {
            const voiced = 0.1 + 0.2 * Math.max(0, Math.sin(Math.PI * 2 * this.timeInWaveform / this.waveformLength));
            return this.targetTenseness * this.intensity * voiced + (1 - this.targetTenseness * this.intensity) * 0.3;
        }
        adjustParameters(deltaTime) {
            const delta = deltaTime * this.sampleRate / 512;
            const oldTime = this.sampleCount / this.sampleRate;
            const newTime = oldTime + deltaTime;
            this.adjustIntensity(delta);
            this.calculateNewFrequency(newTime, delta);
            this.calculateNewTenseness(newTime);
        }
        calculateNewFrequency(time, delta) {
            if (this.intensity == 0) {
                this.smoothFrequency = this.targetFrequency;
            }
            else if (this.targetFrequency > this.smoothFrequency) {
                this.smoothFrequency = Math.min(this.smoothFrequency * (1 + 0.1 * delta), this.targetFrequency);
            }
            else if (this.targetFrequency < this.smoothFrequency) {
                this.smoothFrequency = Math.max(this.smoothFrequency / (1 + 0.1 * delta), this.targetFrequency);
            }
            this.oldFrequency = this.newFrequency;
            this.newFrequency = Math.max(10, this.smoothFrequency * (1 + this.calculateVibrato(time)));
        }
        calculateNewTenseness(time) {
            this.oldTenseness = this.newTenseness;
            this.newTenseness = Math.max(0, this.targetTenseness + 0.1 * simplex1(time * 0.46) + 0.05 * simplex1(time * 0.36));
            if (!this.isTouched && this.alwaysVoice) {
                this.newTenseness += (3 - this.targetTenseness) * (1 - this.intensity);
            }
        }
        adjustIntensity(delta) {
            if (this.isTouched || this.alwaysVoice) {
                this.intensity += 0.13 * delta;
            }
            else {
                this.intensity -= 0.05 * delta;
            }
            this.intensity = clamp(this.intensity, 0, 1);
        }
        calculateVibrato(time) {
            let vibrato = 0;
            vibrato += this.vibratoAmount * Math.sin(2 * Math.PI * time * this.vibratoFrequency);
            vibrato += 0.02 * simplex1(time * 4.07);
            vibrato += 0.04 * simplex1(time * 2.15);
            if (this.autoWobble) {
                vibrato += 0.2 * simplex1(time * 0.98);
                vibrato += 0.4 * simplex1(time * 0.5);
            }
            return vibrato;
        }
        setupWaveform(lambda) {
            const frequency = this.oldFrequency * (1 - lambda) + this.newFrequency * lambda;
            const tenseness = this.oldTenseness * (1 - lambda) + this.newTenseness * lambda;
            this.waveformLength = 1 / frequency;
            this.loudness = Math.pow(Math.max(0, tenseness), 0.25);
            const rd = clamp(3 * (1 - tenseness), 0.5, 2.7);
            const ra = -0.01 + 0.048 * rd;
            const rk = 0.224 + 0.118 * rd;
            const rg = (rk / 4) * (0.5 + 1.2 * rk) / (0.11 * rd - ra * (0.5 + 1.2 * rk));
            const ta = ra;
            const tp = 1 / (2 * rg);
            const te = tp + tp * rk;
            const epsilon = 1 / ta;
            const shift = Math.exp(-epsilon * (1 - te));
            const delta = 1 - shift;
            const rhsIntegral = ((1 / epsilon) * (shift - 1) + (1 - te) * shift) / delta;
            const totalLowerIntegral = rhsIntegral - (te - tp) / 2;
            const totalUpperIntegral = -totalLowerIntegral;
            const omega = Math.PI / tp;
            const s = Math.sin(omega * te);
            const y = -Math.PI * s * totalUpperIntegral / (tp * 2);
            const z = Math.log(y);
            const alpha = z / (tp / 2 - te);
            const e0 = -1 / (s * Math.exp(alpha * te));
            this.alpha = alpha;
            this.e0 = e0;
            this.epsilon = epsilon;
            this.shift = shift;
            this.delta = delta;
            this.te = te;
            this.omega = omega;
        }
        normalizedLFWaveform(t) {
            let output;
            if (t > this.te) {
                output = (-Math.exp(-this.epsilon * (t - this.te)) + this.shift) / this.delta;
            }
            else {
                output = this.e0 * Math.exp(this.alpha * t) * Math.sin(this.omega * t);
            }
            return output * this.intensity * this.loudness;
        }
    }

    class Tract {
        constructor(glottis, tractSampleRate) {
            this.n = 44;
            this.bladeStart = 10;
            this.tipStart = 32;
            this.lipStart = 39;
            this.noseLength = 28;
            this.noseStart = this.n - this.noseLength + 1;
            this.glottalReflection = 0.75;
            this.lipReflection = -0.85;
            this.sampleCount = 0;
            this.time = 0;
            this.transients = [];
            this.turbulencePoints = [];
            this.glottis = glottis;
            this.tractSampleRate = tractSampleRate;
            this.fricationNoiseSource = createFilteredNoiseSource(1000, 0.5, tractSampleRate, 0x8000);
            this.diameter = new Float64Array(this.n);
            this.right = new Float64Array(this.n);
            this.left = new Float64Array(this.n);
            this.reflection = new Float64Array(this.n);
            this.newReflection = new Float64Array(this.n);
            this.junctionOutputRight = new Float64Array(this.n);
            this.junctionOutputLeft = new Float64Array(this.n + 1);
            this.maxAmplitude = new Float64Array(this.n);
            this.noseRight = new Float64Array(this.noseLength);
            this.noseLeft = new Float64Array(this.noseLength);
            this.noseJunctionOutputRight = new Float64Array(this.noseLength);
            this.noseJunctionOutputLeft = new Float64Array(this.noseLength + 1);
            this.noseReflection = new Float64Array(this.noseLength);
            this.noseDiameter = new Float64Array(this.noseLength);
            this.noseMaxAmplitude = new Float64Array(this.noseLength);
            this.newReflectionLeft = 0;
            this.newReflectionRight = 0;
            this.newReflectionNose = 0;
        }
        calculateNoseReflections() {
            const a = new Float64Array(this.noseLength);
            for (let i = 0; i < this.noseLength; i++) {
                a[i] = Math.max(1E-6, this.noseDiameter[i] ** 2);
            }
            for (let i = 1; i < this.noseLength; i++) {
                this.noseReflection[i] = (a[i - 1] - a[i]) / (a[i - 1] + a[i]);
            }
        }
        calculateNewBlockParameters() {
            this.calculateMainTractReflections();
            this.calculateNoseJunctionReflections();
        }
        calculateMainTractReflections() {
            const a = new Float64Array(this.n);
            for (let i = 0; i < this.n; i++) {
                a[i] = this.diameter[i] ** 2;
            }
            for (let i = 1; i < this.n; i++) {
                this.reflection[i] = this.newReflection[i];
                const sum = a[i - 1] + a[i];
                this.newReflection[i] = (Math.abs(sum) > 1E-6) ? (a[i - 1] - a[i]) / sum : 1;
            }
        }
        calculateNoseJunctionReflections() {
            this.reflectionLeft = this.newReflectionLeft;
            this.reflectionRight = this.newReflectionRight;
            this.reflectionNose = this.newReflectionNose;
            const velumA = this.noseDiameter[0] ** 2;
            const an0 = this.diameter[this.noseStart] ** 2;
            const an1 = this.diameter[this.noseStart + 1] ** 2;
            const sum = an0 + an1 + velumA;
            this.newReflectionLeft = (Math.abs(sum) > 1E-6) ? (2 * an0 - sum) / sum : 1;
            this.newReflectionRight = (Math.abs(sum) > 1E-6) ? (2 * an1 - sum) / sum : 1;
            this.newReflectionNose = (Math.abs(sum) > 1E-6) ? (2 * velumA - sum) / sum : 1;
        }
        step(glottalOutput, lambda) {
            this.processTransients();
            this.addTurbulenceNoise();
            this.junctionOutputRight[0] = this.left[0] * this.glottalReflection + glottalOutput;
            this.junctionOutputLeft[this.n] = this.right[this.n - 1] * this.lipReflection;
            for (let i = 1; i < this.n; i++) {
                const r = this.reflection[i] * (1 - lambda) + this.newReflection[i] * lambda;
                const w = r * (this.right[i - 1] + this.left[i]);
                this.junctionOutputRight[i] = this.right[i - 1] - w;
                this.junctionOutputLeft[i] = this.left[i] + w;
            }
            {
                const i = this.noseStart;
                let r = this.newReflectionLeft * (1 - lambda) + this.reflectionLeft * lambda;
                this.junctionOutputLeft[i] = r * this.right[i - 1] + (1 + r) * (this.noseLeft[0] + this.left[i]);
                r = this.newReflectionRight * (1 - lambda) + this.reflectionRight * lambda;
                this.junctionOutputRight[i] = r * this.left[i] + (1 + r) * (this.right[i - 1] + this.noseLeft[0]);
                r = this.newReflectionNose * (1 - lambda) + this.reflectionNose * lambda;
                this.noseJunctionOutputRight[0] = r * this.noseLeft[0] + (1 + r) * (this.left[i] + this.right[i - 1]);
            }
            for (let i = 0; i < this.n; i++) {
                const right = this.junctionOutputRight[i] * 0.999;
                const left = this.junctionOutputLeft[i + 1] * 0.999;
                this.right[i] = right;
                this.left[i] = left;
                const amplitude = Math.abs(right + left);
                this.maxAmplitude[i] = Math.max(this.maxAmplitude[i] *= 0.9999, amplitude);
            }
            const lipOutput = this.right[this.n - 1];
            this.noseJunctionOutputLeft[this.noseLength] = this.noseRight[this.noseLength - 1] * this.lipReflection;
            for (let i = 1; i < this.noseLength; i++) {
                const w = this.noseReflection[i] * (this.noseRight[i - 1] + this.noseLeft[i]);
                this.noseJunctionOutputRight[i] = this.noseRight[i - 1] - w;
                this.noseJunctionOutputLeft[i] = this.noseLeft[i] + w;
            }
            for (let i = 0; i < this.noseLength; i++) {
                const right = this.noseJunctionOutputRight[i];
                const left = this.noseJunctionOutputLeft[i + 1];
                this.noseRight[i] = right;
                this.noseLeft[i] = left;
                const amplitude = Math.abs(right + left);
                this.noseMaxAmplitude[i] = Math.max(this.noseMaxAmplitude[i] *= 0.9999, amplitude);
            }
            const noseOutput = this.noseRight[this.noseLength - 1];
            this.sampleCount++;
            this.time = this.sampleCount / this.tractSampleRate;
            return lipOutput + noseOutput;
        }
        processTransients() {
            for (let i = this.transients.length - 1; i >= 0; i--) {
                const trans = this.transients[i];
                const timeAlive = this.time - trans.startTime;
                if (timeAlive > trans.lifeTime) {
                    this.transients.splice(i, 1);
                    continue;
                }
                const amplitude = trans.strength * Math.pow(2, -trans.exponent * timeAlive);
                this.right[trans.position] += amplitude / 2;
                this.left[trans.position] += amplitude / 2;
            }
        }
        addTurbulenceNoise() {
            const fricativeAttackTime = 0.1;
            for (const p of this.turbulencePoints) {
                if (p.position < 2 || p.position > this.n) {
                    continue;
                }
                if (p.diameter <= 0) {
                    continue;
                }
                let intensity;
                if (isNaN(p.endTime)) {
                    intensity = clamp((this.time - p.startTime) / fricativeAttackTime, 0, 1);
                }
                else {
                    intensity = clamp(1 - (this.time - p.endTime) / fricativeAttackTime, 0, 1);
                }
                if (intensity <= 0) {
                    continue;
                }
                const turbulenceNoise = 0.66 * this.fricationNoiseSource() * intensity * this.glottis.getNoiseModulator();
                this.addTurbulenceNoiseAtPosition(turbulenceNoise, p.position, p.diameter);
            }
        }
        addTurbulenceNoiseAtPosition(turbulenceNoise, position, diameter) {
            const i = Math.floor(position);
            const delta = position - i;
            const thinness0 = clamp(8 * (0.7 - diameter), 0, 1);
            const openness = clamp(30 * (diameter - 0.3), 0, 1);
            const noise0 = turbulenceNoise * (1 - delta) * thinness0 * openness;
            const noise1 = turbulenceNoise * delta * thinness0 * openness;
            if (i + 1 < this.n) {
                this.right[i + 1] += noise0 / 2;
                this.left[i + 1] += noise0 / 2;
            }
            if (i + 2 < this.n) {
                this.right[i + 2] += noise1 / 2;
                this.left[i + 2] += noise1 / 2;
            }
        }
    }

    const gridOffset = 1.7;
    class TractShaper {
        constructor(tract) {
            this.movementSpeed = 15;
            this.velumOpenTarget = 0.4;
            this.velumClosedTarget = 0.01;
            this.lastObstruction = -1;
            this.tract = tract;
            this.targetDiameter = new Float64Array(tract.n);
            this.tongueIndex = 12.9;
            this.tongueDiameter = 2.43;
            this.shapeNose(true);
            tract.calculateNoseReflections();
            this.shapeNose(false);
            this.shapeMainTract();
        }
        shapeMainTract() {
            const tract = this.tract;
            for (let i = 0; i < tract.n; i++) {
                const d = this.getRestDiameter(i);
                tract.diameter[i] = d;
                this.targetDiameter[i] = d;
            }
        }
        getRestDiameter(i) {
            const tract = this.tract;
            if (i < 7) {
                return 0.6;
            }
            if (i < tract.bladeStart) {
                return 1.1;
            }
            if (i >= tract.lipStart) {
                return 1.5;
            }
            const t = 1.1 * Math.PI * (this.tongueIndex - i) / (tract.tipStart - tract.bladeStart);
            const fixedTongueDiameter = 2 + (this.tongueDiameter - 2) / 1.5;
            let curve = (1.5 - fixedTongueDiameter + gridOffset) * Math.cos(t);
            if (i == tract.bladeStart - 2 || i == tract.lipStart - 1) {
                curve *= 0.8;
            }
            if (i == tract.bladeStart || i == tract.lipStart - 2) {
                curve *= 0.94;
            }
            return 1.5 - curve;
        }
        adjustTractShape(deltaTime) {
            const tract = this.tract;
            const amount = deltaTime * this.movementSpeed;
            let newLastObstruction = -1;
            for (let i = 0; i < tract.n; i++) {
                const diameter = tract.diameter[i];
                const targetDiameter = this.targetDiameter[i];
                if (diameter <= 0) {
                    newLastObstruction = i;
                }
                let slowReturn;
                if (i < tract.noseStart) {
                    slowReturn = 0.6;
                }
                else if (i >= tract.tipStart) {
                    slowReturn = 1;
                }
                else {
                    slowReturn = 0.6 + 0.4 * (i - tract.noseStart) / (tract.tipStart - tract.noseStart);
                }
                tract.diameter[i] = moveTowards(diameter, targetDiameter, slowReturn * amount, 2 * amount);
            }
            if (this.lastObstruction > -1 && newLastObstruction == -1 && tract.noseDiameter[0] < 0.223) {
                this.addTransient(this.lastObstruction);
            }
            this.lastObstruction = newLastObstruction;
            tract.noseDiameter[0] = moveTowards(tract.noseDiameter[0], this.velumTarget, amount * 0.25, amount * 0.1);
        }
        addTransient(position) {
            const tract = this.tract;
            const transient = {
                position: position,
                startTime: tract.time,
                lifeTime: 0.2,
                strength: 0.3,
                exponent: 200
            };
            tract.transients.push(transient);
        }
        shapeNose(velumOpen) {
            const tract = this.tract;
            this.velumTarget = velumOpen ? this.velumOpenTarget : this.velumClosedTarget;
            for (let i = 0; i < tract.noseLength; i++) {
                let diameter;
                const d = 2 * (i / tract.noseLength);
                if (i == 0) {
                    diameter = this.velumTarget;
                }
                else if (d < 1) {
                    diameter = 0.4 + 1.6 * d;
                }
                else {
                    diameter = 0.5 + 1.5 * (2 - d);
                }
                diameter = Math.min(diameter, 1.9);
                tract.noseDiameter[i] = diameter;
            }
        }
    }

    const maxBlockLength = 512;
    class Synthesizer {
        constructor(sampleRate) {
            this.sampleRate = sampleRate;
            this.glottis = new Glottis(sampleRate);
            const tractSampleRate = 2 * sampleRate;
            this.tract = new Tract(this.glottis, tractSampleRate);
            this.tractShaper = new TractShaper(this.tract);
        }
        reset() {
            this.calculateNewBlockParameters(0);
        }
        synthesize(buf) {
            let p = 0;
            while (p < buf.length) {
                const blockLength = Math.min(maxBlockLength, buf.length - p);
                const blockBuf = buf.subarray(p, p + blockLength);
                this.synthesizeBlock(blockBuf);
                p += blockLength;
            }
        }
        synthesizeBlock(buf) {
            const n = buf.length;
            const deltaTime = n / this.sampleRate;
            this.calculateNewBlockParameters(deltaTime);
            for (let i = 0; i < n; i++) {
                const lambda1 = i / n;
                const lambda2 = (i + 0.5) / n;
                const glottalOutput = this.glottis.step(lambda1);
                const vocalOutput1 = this.tract.step(glottalOutput, lambda1);
                const vocalOutput2 = this.tract.step(glottalOutput, lambda2);
                buf[i] = (vocalOutput1 + vocalOutput2) * 0.125;
            }
        }
        calculateNewBlockParameters(deltaTime) {
            this.glottis.adjustParameters(deltaTime);
            this.tractShaper.adjustTractShape(deltaTime);
            this.tract.calculateNewBlockParameters();
        }
    }

    var audioContext;
    var synthesizer;
    var audioPlayer;
    var mainUi;
    function animationFrameHandler() {
        mainUi.draw();
        requestAnimationFrame(animationFrameHandler);
    }
    function mainUi_screenSwitched() {
        if (mainUi.screen == 0) {
            audioPlayer.start();
        }
        else {
            audioPlayer.stop();
        }
    }
    function init() {
        const canvas = document.getElementById("canvas");
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioContext.sampleRate;
        synthesizer = new Synthesizer(sampleRate);
        audioPlayer = new AudioPlayer(synthesizer, audioContext);
        mainUi = new MainUi(synthesizer, canvas);
        mainUi.addEventListener("screen-switched", mainUi_screenSwitched);
        mainUi.draw();
        requestAnimationFrame(animationFrameHandler);
    }
    document.addEventListener("DOMContentLoaded", init);

}());
