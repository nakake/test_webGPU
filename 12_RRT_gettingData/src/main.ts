import { Renderer } from "./view/renderer";
import { Scene } from "./view/scene";

const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("gfx-main");

const scene = new Scene();
const renderer = new Renderer(canvas, scene);

renderer.Initialize();