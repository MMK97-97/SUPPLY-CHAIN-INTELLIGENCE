(function () {
  'use strict';
  class ScanCamera {
    constructor(video, onState, env = {}) {
      this.video = video; this.onState = onState || (() => {});
      this.env = {navigator:window.navigator, secure:window.isSecureContext, BarcodeDetector:window.BarcodeDetector,
        loadZXing:async()=>window.ZXingBrowser, setTimeout:window.setTimeout.bind(window), clearTimeout:window.clearTimeout.bind(window), ...env};
      this.generation = 0; this.armGeneration = 0; this.running = false; this.starting = false; this.facing = 'environment';
    }
    arm(handler) { this.armGeneration++; this.handler = handler; this.armed = true; this.onState('Ready to scan'); }
    disarm() { this.armGeneration++; this.armed = false; this.handler = null; }
    deliver(value, generation, armGeneration = this.armGeneration) {
      if (!this.running || generation !== this.generation || !this.armed || armGeneration !== this.armGeneration) return;
      const handler = this.handler; this.disarm(); this.onState('Scan captured · ready for the next unit'); handler?.(value);
    }
    async start() {
      this.stop(false);
      if (!this.env.secure || !this.env.navigator?.mediaDevices?.getUserMedia) throw new Error('Camera access requires the HTTPS website. You can still use a handheld scanner or enter a barcode.');
      const generation = this.generation; this.starting = true; this.onState('Allow camera access to start scanning');
      let stream;
      try {
        stream = await this.env.navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:this.facing},width:{ideal:1280},height:{ideal:720}}});
        if (generation !== this.generation) { stream.getTracks().forEach(track=>track.stop()); return false; }
        this.stream=stream;this.video.srcObject=stream;this.video.muted=true;this.video.setAttribute('playsinline','');
        await this.video.play();
        if (generation !== this.generation) return false;
        this.running=true;this.starting=false;
        let detector;
        if(this.env.BarcodeDetector)try{
          const formats=await this.env.BarcodeDetector.getSupportedFormats();
          if(['code_128','ean_13','ean_8','upc_a','qr_code'].every(format=>formats.includes(format)))detector=new this.env.BarcodeDetector({formats:['code_128','code_39','ean_13','ean_8','upc_a','upc_e','qr_code','data_matrix','itf'].filter(format=>formats.includes(format))});
        }catch(_){}
        if(generation!==this.generation)return false;
        if(detector){
          let errors=0;
          const tick=async()=>{
            if(!this.running || generation!==this.generation)return;
            const arm=this.armGeneration;
            try {if(this.armed && this.video.readyState>=2){const results=await detector.detect(this.video);if(results[0]?.rawValue)this.deliver(results[0].rawValue,generation,arm);}errors=0;}
            catch(_){if(++errors>=3){try{await this.startFallback(generation);}catch(error){this.stop();this.onState(error.message,true);}return;}}
            if(this.running && generation===this.generation)this.timer=this.env.setTimeout(tick,160);
          };tick();
        } else await this.startFallback(generation);
        if(generation!==this.generation)return false;
        this.onState('Camera ready'); return true;
      } catch(error) {
        if(generation!==this.generation){stream?.getTracks().forEach(track=>track.stop());return false;}
        this.stop();
        const messages={NotAllowedError:'Camera permission was denied. Allow camera access in your browser settings, or use the barcode entry field.',NotFoundError:'No camera was found. Connect a webcam, use your phone, or enter the barcode.',NotReadableError:'The camera is in use by another app. Close it there and try again.',OverconstrainedError:'This camera could not use the requested settings. Try switching camera.'};
        throw new Error(messages[error.name] || error.message || 'The camera could not start. Use the barcode entry field.');
      }
    }
    async startFallback(generation) {
      const ZXing=await this.env.loadZXing();
      if(generation!==this.generation || !this.running)return;
      if(!ZXing?.BrowserMultiFormatReader)throw new Error('The barcode reader could not load. Reload the page or use the barcode entry field.');
      const reader=new ZXing.BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:180,delayBetweenScanSuccess:350});
      const controls=await reader.decodeFromStream(this.stream,this.video,(result)=>{if(result)this.deliver(result.getText(),generation);});
      if(generation!==this.generation || !this.running){controls.stop();return;}
      this.controls=controls;
    }
    async switchCamera() { this.facing=this.facing==='environment'?'user':'environment';return this.start(); }
    canTorch() { return !!this.stream?.getVideoTracks?.()[0]?.getCapabilities?.().torch; }
    async toggleTorch() {
      const track=this.stream?.getVideoTracks?.()[0];
      if(!track?.getCapabilities?.().torch)throw new Error('This camera does not support a torch.');
      await track.applyConstraints({advanced:[{torch:!this.torch}]});this.torch=!this.torch;return this.torch;
    }
    stop(announce=true) {
      this.generation++;this.disarm();this.running=false;this.starting=false;
      this.env.clearTimeout(this.timer);this.timer=null;
      try{this.controls?.stop();}catch(_){}this.controls=null;
      this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
      if(this.video)this.video.srcObject=null;this.torch=false;
      if(announce)this.onState('Camera stopped');
    }
  }
  window.MK97ScanCamera=ScanCamera;
})();
