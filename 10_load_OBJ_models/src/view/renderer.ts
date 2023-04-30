import shader from "./shaders/shader.wgsl";
import { TriangleMesh } from "./triangle_mesh";
import { Quad } from "../model/quad";
import { mat4 } from "gl-matrix";
import { Material } from "./material";
import { RenderData, object_types } from "../model/definitions";
import { QuadMesh } from "./quad_mesh";
import { ObjMesh } from "./obj_mesh";

export class Renderer {
    canvas: HTMLCanvasElement;

    adapter! : GPUAdapter;
    device! :GPUDevice;
    context! : GPUCanvasContext;
    format!: GPUTextureFormat;

    //pipeline
    uniform_buffer!: GPUBuffer;
    pipeline!: GPURenderPipeline;
    frameBindGroup!:GPUBindGroup;
    frameGroupLayout!:GPUBindGroupLayout;
    materialGroupLayout!:GPUBindGroupLayout;

    //depth stencil stuff
    depthStencilState!: GPUDepthStencilState;
    depthStencilBuffer!: GPUTexture;
    depthStencilView!: GPUTextureView;
    depthStencilAttachment!: GPURenderPassDepthStencilAttachment;

    //assets
    tariangle_mesh!: TriangleMesh;
    quad_mesh!: QuadMesh;
    statue_mesh!: ObjMesh;
    triangle_material!: Material;
    quad_material!: Material;
    objectBuffer!: GPUBuffer;

    constructor(canvas: HTMLCanvasElement){
        this.canvas = canvas;
    }

    async initialize(){

        await this.setup_device();
        await this.makeBindGroupLayout();
        await this.create_assetes();
        await this.make_depth_buffer_resources();
        await this.make_pipeline();
        await this.makeBindGroup();
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

    async makeBindGroupLayout(){
        this.frameGroupLayout = this.device.createBindGroupLayout({
            entries:[
                {
                    binding:0,
                    visibility:GPUShaderStage.VERTEX,
                    buffer:{}
                },
                {
                    binding: 1,
                    visibility:GPUShaderStage.VERTEX,
                    buffer:{
                        type:"read-only-storage",
                        hasDynamicOffset: false
                    }
                }
            ]
        }); 

        this.materialGroupLayout = this.device.createBindGroupLayout({
            entries:[
                {
                    binding: 0,
                    visibility:GPUShaderStage.FRAGMENT,
                    texture:{}
                },
                {
                    binding: 1,
                    visibility:GPUShaderStage.FRAGMENT,
                    sampler:{}
                },
            ]
        }); 
    }

    async makeBindGroup(){
        this.frameBindGroup = this.device.createBindGroup({
            layout: this.frameGroupLayout,
            entries:[
                {
                    binding:0,
                    resource:{
                        buffer: this.uniform_buffer
                    }
                },
                {
                    binding:1,
                    resource:{
                        buffer:this.objectBuffer
                    }
                }
            ]
        });
    }

    async make_pipeline(){

        const pipeline_layout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.frameGroupLayout, this.materialGroupLayout]
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
        this.quad_mesh = new QuadMesh(this.device);
        this.statue_mesh = new ObjMesh();
        await this.statue_mesh.initialize(this.device, "dist/models/statue.obj");
        this.triangle_material = new Material();
        this.quad_material = new Material();

        this.uniform_buffer = this.device.createBuffer({
            size:64 * 2,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const modelBufferDescriptor: GPUBufferDescriptor = {
            size: 64 * 1024,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        };
        this.objectBuffer = this.device.createBuffer(modelBufferDescriptor);
        
        await this.triangle_material.initialize(this.device, "dist/img/chat.jpg", this.materialGroupLayout);
        await this.quad_material.initialize(this.device, "dist/img/floor.jpg", this.materialGroupLayout);
    }

    async render(renderables: RenderData) {

        if(!this.device || !this.pipeline){
            return;
        }

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, 800/600, 0.1, 10);
        
        const view = renderables.view_transform;

        this.device.queue.writeBuffer(
            this.objectBuffer, 0, 
            renderables.model_transforms, 0, renderables.model_transforms.length
        );
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
        renderpass.setBindGroup(0, this.frameBindGroup);

        var object_drawn: number = 0;

        renderpass.setVertexBuffer(0, this.tariangle_mesh.buffer);
        renderpass.setBindGroup(1, this.triangle_material.bindGroup);
        renderpass.draw(3, renderables.object_counts[object_types.TRIANGLE], 0 ,object_drawn);
        object_drawn += renderables.object_counts[object_types.TRIANGLE];

        renderpass.setVertexBuffer(0, this.quad_mesh.buffer);
        renderpass.setBindGroup(1, this.quad_material.bindGroup);
        renderpass.draw(6, renderables.object_counts[object_types.QUAD], 0 ,object_drawn);
        object_drawn += renderables.object_counts[object_types.QUAD];

        renderpass.setVertexBuffer(0, this.statue_mesh.buffer);
        renderpass.setBindGroup(1, this.triangle_material.bindGroup);
        renderpass.draw(
            this.statue_mesh.vertexCount, 1, 
            0 ,object_drawn);
        object_drawn += 1;

        renderpass.end();

        this.device.queue.submit([command_encorder.finish()]);
    }
}
