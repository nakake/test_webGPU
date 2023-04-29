import shader from "./shaders/shader.wgsl";
import { TriangleMesh } from "./triangle_mesh";
import { mat4 } from "gl-matrix";

export class Renderder {
    canvas: HTMLCanvasElement;

    adapter! : GPUAdapter;
    device! :GPUDevice;
    context! : GPUCanvasContext;
    format!: GPUTextureFormat;

    uniform_buffer!: GPUBuffer;
    bind_group!: GPUBindGroup;
    pipeline!: GPURenderPipeline;

    tariangle_mesh!: TriangleMesh;

    t: number;

    constructor(canvas: HTMLCanvasElement){
        this.canvas = canvas;
        this.t = 0.0;
    }

    async Initialize(){

        await this.setup_device();
        this.create_assetes();
        await this.make_pipeline();
        this.render();
    }

    async setup_device(){

        this.adapter = <GPUAdapter> await navigator.gpu?.requestAdapter();
        
        this.device = <GPUDevice> await this.adapter?.requestDevice();

        this.context = <GPUCanvasContext> this.canvas.getContext("webgpu");

        this.format = "bgra8unorm";

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "opaque"
        });
    }

    async make_pipeline(){

        this.uniform_buffer = this.device.createBuffer({
            size:64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const bind_group_layout = this.device.createBindGroupLayout({
            entries:[
                {
                    binding:0,
                    visibility:GPUShaderStage.VERTEX,
                    buffer:{}
                }
            ]
        }); 

        this.bind_group = this.device.createBindGroup({
            layout: bind_group_layout,
            entries: [
                {
                    binding:0,
                    resource:{
                        buffer:this.uniform_buffer
                    }
                }
            ]
        });

        const pipeline_layout = this.device.createPipelineLayout({
            bindGroupLayouts: [bind_group_layout]
        });

        this.pipeline = this.device.createRenderPipeline({
            vertex:{
                module:this.device.createShaderModule({
                    code:shader
                }),
                entryPoint:"vs_main",
                buffers:[this.tariangle_mesh.bufferLayout,]
            },

            fragment:{
                module:this.device.createShaderModule({
                    code: shader
                }),
                entryPoint:"fs_main",
                targets:[{
                    format:this.format
                }]
            },

            primitive:{
                topology: "triangle-list"
            },

            layout:pipeline_layout
        });

    }

    create_assetes(){
        this.tariangle_mesh = new TriangleMesh(this.device);
    }

    render = () =>{

        this.t += 0.01;

        if(this.t > 2.0 * Math.PI){
            this.t -= 2.0 * Math.PI;
        }

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, 800/600, 0.1, 10);
        
        const view = mat4.create();
        mat4.lookAt(view , [-2, 0, 2], [0, 0, 0], [0, 0, 1]);

        const model = mat4.create();
        mat4.rotate(model, model, this.t, [0, 0, 1]);

        this.device.queue.writeBuffer(this.uniform_buffer, 0, <ArrayBuffer>model);
        this.device.queue.writeBuffer(this.uniform_buffer, 64, <ArrayBuffer>view);
        this.device.queue.writeBuffer(this.uniform_buffer, 128, <ArrayBuffer>projection);

        const command_encorder : GPUCommandEncoder = this.device.createCommandEncoder();

        const texture_view : GPUTextureView  = this.context.getCurrentTexture().createView();

        const renderpass : GPURenderPassEncoder = command_encorder.beginRenderPass({
            colorAttachments:[{
                view:texture_view,
                clearValue:{ r:0.5, g:0.0, b:0.25, a:1.0 },
                loadOp:"clear",
                storeOp:"store"
            }]
        });

        renderpass.setPipeline(this.pipeline);
        renderpass.setVertexBuffer(0, this.tariangle_mesh.buffer);
        renderpass.setBindGroup(0, this.bind_group);
        renderpass.draw(3, 1, 0 ,0);
        renderpass.end();

        this.device.queue.submit([command_encorder.finish()]);

        requestAnimationFrame(this.render);
    }
}
