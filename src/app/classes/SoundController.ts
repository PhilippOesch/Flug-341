
//Custom Classes
import { SceneSound } from './SceneSound';
import { Sound } from './Sound';
import { HRTFSound } from './HRTFSound'; //class for multichannel Sounds
import { MultichannelSound } from './MultichannelSound'; //class for multichannel Sounds

import { DeviceOrientation, DeviceOrientationCompassHeading } from '@ionic-native/device-orientation/ngx';

/* needed that for building apk directly on Smartphone */

import json from '../../assets/json/sound.json';

// TODO: Need a lot of work. Don't know what to say.
//declare ambisonics
declare const ambisonics;

export class SoundController {

    soundMap: Map<number, any>;         //Map with all the currently playing sound
    context;                            //Audio Context
    orientation: DeviceOrientation;     //Device Orientation
    soundArray: any;                    //This Variable takes on the Json Array of the Current Chapter
    heading: number;                    //Current Rotation from Device Orientation
    order= 4;                           //Max Order
    loader_filters;                     //for Loading Filters like HRTF-Curves(sofa.json-files)
    initheading= 0;
    subscription;                //Initial Rotation

    rotator;                            //Scene Rotator
    decoder;
    mirror                            //Ambisonics Bineural Decoder

    constructor(protected deviceOrientation: DeviceOrientation, chapter: number) {
        this.soundMap = new Map();
        this.context = new AudioContext();
        //this.context = /*(window.AudioContext) ? */new window.AudioContext /*: new window.webkitAudioContext*/;
        this.orientation = this.deviceOrientation;
        this.heading = 0;
        this.soundArray = json[chapter - 1];
        this.decoder = new ambisonics.binDecoder2D(this.context, this.order);
    }


//init just the Controller
initController() {

        //Initialise Device Orientation Listener
        this.subscription = this.deviceOrientation.watchHeading().subscribe(
            (data: DeviceOrientationCompassHeading) => {
                this.heading = data.magneticHeading;

                //Update Rotation
                this.rotator.yaw = this.heading;
                this.rotator.updateRotMtx();
                //this.hoaEncoder(data.magneticHeading);
            },
        );
        
        // intitalise Bineural Decoder
        //this.encoder = new ambisonics.monoEncoder(this.context, this.order);
    
        //initalise Scene Rotator
        this.mirror = new ambisonics.sceneMirror2D(this.context, this.order);
        const firstmirror= new ambisonics.sceneMirror2D(this.context, this.order);
        this.rotator = new ambisonics.sceneRotator2D(this.context, this.order);
        
        //connect to Context
        this.mirror.out.connect(firstmirror.in);
        firstmirror.out.connect(this.rotator.in)
        this.rotator.out.connect(this.decoder.in);
        this.decoder.out.connect(this.context.destination);
        this.decoder.resetFilters();
        firstmirror.mirror(1);
        this.mirror.mirror(2);
                
        //load HRTF-Curves
        this.loader_filters = new ambisonics.HRIRloader2D_local(this.context, this.order, (buffer)=> {
            console.log('successfully loaded HOA buffer:', buffer);
            console.log(this.decoder);
            this.decoder.updateFilters(buffer);
        });
        this.loader_filters.load("assets/IRs/IRC_1076_C_HRIR_44100.sofa.json");
        console.log(this.loader_filters);

        //set Initial Heading and update the Scene Rotator
        this.initheading= this.heading;
        this.rotator.yaw = this.heading;
        this.rotator.updateRotMtx();
    }

    playSound(index: number, isHrtf= false) {
        if (this.soundMap.has(index) && this.soundMap.get(index).isPlaying) {
            // Sound is already playing
            console.log('sound is already playing');
        } else if (this.soundMap.has(index)) {

            // Start playing the Sound
            const sound = this.soundMap.get(index);

            // Check whether to loop the Sound
            if (this.soundArray[index].loop) {
                sound.playloop(3000);
            }
            else {
                sound.play();
            }
            console.log(this.soundArray[index].name + ' started playing');
        } else {

            // load the Sound and start playing it
            const value = this.soundArray[index];

            this.soundMap.set(value.name, new SceneSound(this.context, this.orientation, value.name, value.order, value.startpoint, this.rotator, this.mirror));

            const sound = this.soundMap.get(value.name);
            sound.init();
            sound.loadSound();

            // Check whether to loop the Sound
            if (this.soundArray[index].loop) {
                sound.playloop(3000);
            }
            else {
                sound.play();
            }
            console.log(this.soundArray[index].name + ' started playing.');
        }
    }

    //Stop Sound with index from json-File
    stopSound(index: number, hrtf= false) {

        // Check if sound is inside the Map
        if (this.soundMap.has(index)) {

            // Stop playing Sound
            const sound = this.soundMap.get(index);
            if(hrtf){
                sound.onDestroy();
            }

            sound.stop();

            this.soundMap.delete(index);

            console.log('Sound deactivated');
        } else {

            // Sound is not inside Map
            console.log('Sound already deactivated');
        }
    }

    //init one specific sound
    initSound(index, startpoint= 0, typ= "", gain= 1) /* Typ: "multi" or else HRTF, Index: Index from JSON-Array */{
        //check Sound-Type
        if(typ=== "multi"){
            this.soundMap.set(index, new MultichannelSound(this.context, this.orientation, this.soundArray[index].name, this.soundArray[index].order,  this.setHeading(startpoint), this.rotator));
        } else {
            this.soundMap.set(index, new SceneSound(this.context, this.orientation, this.soundArray[index].name, this.soundArray[index].order,  this.setHeading(startpoint), this.rotator, this.mirror));
        }
        const sound = this.soundMap.get(index);
        sound.init();
        sound.loadSound();
        sound.setGain(gain);
    }

    //adjust the heading accordingly for the proper sound position
    setHeading(startpoint){
        //for some reason everything is turned +180 degrees, dont know why 
        return (startpoint)% 360;

        // return (startpoint+180)% 360;
    }

    //Stop sll Sound currently playing
    stopAllSounds(){
        for (let i=0; i< this.soundArray.length; i++) {
            const isPlaying = this.soundMap.get(i).isPlaying;
            if(isPlaying) {
            this.stopSound(i);
            }
        }
    }

    // hoaEncoder(azim: number) {
    //     this.encoder.azim = azim; // Horizontal Position
    //     // this.encoder.elev = this.elev; // Vertical Position
    //     this.encoder.updateGains();
    //     console.log(this.encoder);
    // }

    getDuration(index: number){
        return this.soundArray[index].duration;

    }


    crossfade(indexSound1: number, indexSound2: number, duration: number){
        // 1. Sound: fades to 0
        let sound1 = this.soundMap.get(indexSound1);
        // 2. Sound fades to 1
        let sound2 = this.soundMap.get(indexSound2);
        console.log("start Crossfade");

        //ramp gain down to 0
        sound1.summator.gain.linearRampToValueAtTime(0.0, this.context.currentTime + duration);   //linear
        //sound1.summator.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);    //exponetial

        //ramp gain up to 1
        sound2.summator.gain.linearRampToValueAtTime(1.0, this.context.currentTime + duration);   //linear
        //sound2.summator.gain.exponentialRampToValueAtTime(1.0, this.context.currentTime + duration);    //exponetial
    }

    onDestroy(){
        this.subscription.unsubscribe();
    }
}
