import { Renderder } from "./renderer";

const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("gfx-main");

const renderer = new Renderder(canvas);

renderer.Initialize();