import shader from "./shaders/shader.wgsl";
import { TriangleMesh } from "./triangle_mesh";
import { mat4 } from "gl-matrix";
import { Material } from "./material";
import { Camera } from "../model/camera";
import { Triangle } from "../model/triangle";

export class Renderer {
    canvas: HTMLCanvasElement;

    adapter! : GPUAdapter;
    device! :GPUDevice;
    context! : GPUCanvasContext;
    format!: GPUTextureFormat;

    //pipeline
    uniform_buffer!: GPUBuffer;
    bind_group!: GPUBindGroup;
    pipeline!: GPURenderPipeline;

    //depth stencil stuff
    depthStencilState!: GPUDepthStencilState;
    depthStencilBuffer!: GPUTexture;
    depthStencilView!: GPUTextureView;
    depthStencilAttachment!: GPURenderPassDepthStencilAttachment;

    //assets
    tariangle_mesh!: TriangleMesh;
    material!: Material;
    objectBuffer!: GPUBuffer;

    constructor(canvas: HTMLCanvasElement){
        this.canvas = canvas;
    }

    async initialize(){

        await this.setup_device();
        await this.create_assetes();
        await this.make_depth_buffer_resources();
        await this.make_pipeline();
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

    async make_depth_buffer_resources(){
        this.depthStencilState = {
            format:"depth24plus-stencil8",
            depthWriteEnabled: true,
            depthCompare: "less-equal",
        };

        const size: GPUExtent3D = {
            width: this.canvas.width,
            height: this.canvas.height,
            depthOrArrayLayers: 1
        };

        const depthBufferDescriptor: GPUTextureDescriptor = {
            size: size,
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        };

        this.depthStencilBuffer = this.device.createTexture(depthBufferDescriptor);

        const viewDescriptor: GPUTextureViewDescriptor = {
            format: "depth24plus-stencil8",
            dimension: "2d",
            aspect: "all"
        };

        this.depthStencilView = this.depthStencilBuffer.createView(viewDescriptor);
        this.depthStencilAttachment = {
            view: this.depthStencilView,
            depthClearValue: 1.0,
            depthLoadOp: "clear",
            depthStoreOp: "store",

            stencilLoadOp: "clear",
            stencilStoreOp: "discard"
        };

    }

    async make_pipeline(){

        this.uniform_buffer = this.device.createBuffer({
            size:64 * 2,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const bind_group_layout = this.device.createBindGroupLayout({
            entries:[
                {
                    binding:0,
                    visibility:GPUShaderStage.VERTEX,
                    buffer:{}
                },
                {
                    binding: 1,
                    visibility:GPUShaderStage.FRAGMENT,
                    texture:{}
                },
                {
                    binding: 2,
                    visibility:GPUShaderStage.FRAGMENT,
                    sampler:{}
                },
                {
                    binding: 3,
                    visibility:GPUShaderStage.VERTEX,
                    buffer:{
                        type:"read-only-storage",
                        hasDynamicOffset: false
                    }
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
                },
                {
                    binding:1,
                    resource:this.material.view
                },
                {
                    binding:2,
                    resource:this.material.sampler
                },
                {
                    binding:3,
                    resource:{
                        buffer:this.objectBuffer
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

            layout:pipeline_layout,
            depthStencil: this.depthStencilState,
        });

    }

    async create_assetes(){
        this.tariangle_mesh = new TriangleMesh(this.device);
        this.material = new Material();

        const modelBufferDescriptor: GPUBufferDescriptor = {
            size: 64 * 1024,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.objectBuffer = this.device.createBuffer(modelBufferDescriptor);
        
        await this.material.initialize(this.device, "dist/img/chat.jpg");
    }

    async render(camera: Camera, triangles: Float32Array, triangle_count: number) {

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, 800/600, 0.1, 10);
        
        const view = camera.get_view();

        this.device.queue.writeBuffer(this.objectBuffer, 0, triangles, 0, triangles.length);
        this.device.queue.writeBuffer(this.uniform_buffer, 0, <ArrayBuffer>view);
        this.device.queue.writeBuffer(this.uniform_buffer, 64, <ArrayBuffer>projection);

        const command_encorder : GPUCommandEncoder = this.device.createCommandEncoder();

        const texture_view : GPUTextureView  = this.context.getCurrentTexture().createView();

        const renderpass : GPURenderPassEncoder = command_encorder.beginRenderPass({
            colorAttachments:[{
                view:texture_view,
                clearValue:{ r:0.5, g:0.0, b:0.25, a:1.0 },
                loadOp:"clear",
                storeOp:"store"
            }],
            depthStencilAttachment:this.depthStencilAttachment,
        });

        renderpass.setPipeline(this.pipeline);
        renderpass.setVertexBuffer(0, this.tariangle_mesh.buffer);
        renderpass.setBindGroup(0, this.bind_group);
        renderpass.draw(3, triangle_count, 0 ,0); 
        renderpass.end();

        this.device.queue.submit([command_encorder.finish()]);
    }
}
