import { vec2,vec3 } from "gl-matrix";

export class ObjMesh {

    buffer!: GPUBuffer
    bufferLayout!: GPUVertexBufferLayout
    v:vec3[];
    vt:vec2[];
    vn:vec3[];
    vertices!:Float32Array;
    vertexCount!: number;

    constructor(){
        this.v = [];
        this.vt = [];
        this.vn = [];
    }
    
    async initialize(device: GPUDevice, url:string) {

        await this.read_file(url);
        this.vertexCount = this.vertices.length / 5;

        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

        const descriptor: GPUBufferDescriptor = {
            size: this.vertices.byteLength,
            usage: usage,
            mappedAtCreation: true 
        };

        this.buffer = device.createBuffer(descriptor);

        new Float32Array(this.buffer.getMappedRange()).set(this.vertices);
        this.buffer.unmap();

        this.bufferLayout = {
            //float(4bite) * 5
            arrayStride: 20,
            attributes: [
                {
                    shaderLocation: 0,
                    format: "float32x3",
                    offset: 0
                },
                {
                    shaderLocation: 1,
                    format: "float32x2",
                    offset: 12
                }
            ]
        }

    }

    async read_file(url:string){

        var result:number[] =  [];
        
        const response: Response = await fetch(url);
        const blob: Blob = await response.blob();
        const file_countents = (await blob.text());
        const lines = file_countents.split("\n");

        lines.forEach(
            (line)=>{
                if(line[0] == "v" && line[1] == " "){
                    this.read_vertex_line(line);
                }
                else if(line[0] == "v" && line[1] == "t"){
                    this.read_texcoord_line(line);
                }
                else if(line[0] == "v" && line[1] == "n"){
                    this.read_normal_line(line);
                }
                else if(line[0] == "f"){
                    this.read_face_line(line, result);
                }
            }
        )


        this.vertices = new Float32Array(result);
    }

    read_vertex_line(line: string){
        const components = line.split(" ");
        const new_vertex:vec3 = [
            Number(components[1]).valueOf(),
            Number(components[2]).valueOf(),
            Number(components[3]).valueOf()
        ];

        this.v.push(new_vertex);
    }

    read_texcoord_line(line: string){
        const components = line.split(" ");
        const new_texcoord:vec2 = [
            Number(components[1]).valueOf(),
            Number(components[2]).valueOf(),
        ];

        this.vt.push(new_texcoord);
    }

    read_normal_line(line: string){
        const components = line.split(" ");
        const new_normal:vec3 = [
            Number(components[1]).valueOf(),
            Number(components[2]).valueOf(),
            Number(components[3]).valueOf()
        ];

        this.vn.push(new_normal);
    }

    read_face_line(line: string, result: number[]){
        line = line.replace("\n", " ");
        const vertex_descriptions = line.split(" ");

        const triangle_count = vertex_descriptions.length - 3;
        for(var i = 0; i < triangle_count; i++) {
            this.read_corner(vertex_descriptions[1], result);
            this.read_corner(vertex_descriptions[2+i], result);
            this.read_corner(vertex_descriptions[3+i], result);
        }
    }

    read_corner(vertex_descriptions: string, result: number[]){
        const v_vt_vn = vertex_descriptions.split("/");
        const v = this.v[Number(v_vt_vn[0]).valueOf() - 1];
        const vt = this.vt[Number(v_vt_vn[1]).valueOf() - 1];
        result.push(v[0]);
        result.push(v[1]);
        result.push(v[2]);
        result.push(vt[0]);
        result.push(vt[1]); 
    }
}