import { Renderer } from "./view/renderer";
import { Scene } from "./view/scene";

const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("gfx-main");

const sphereCount: number = 1024;
const sphereCountLabel: HTMLElement = <HTMLElement> document.getElementById("sphere-count");
sphereCountLabel.innerText = sphereCount.toString();


const scene = new Scene(sphereCount);
const renderer = new Renderer(canvas, scene);

renderer.Initialize();