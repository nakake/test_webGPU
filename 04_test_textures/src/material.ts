import { format } from "path";

export class Material{
    
    textuer!: GPUTexture
    view!: GPUTextureView
    sampler!: GPUSampler

    async initialize(device: GPUDevice, url: string){

        const response: Response = await fetch(url);
        const blob: Blob = await response.blob();
        const image_data: ImageBitmap = await createImageBitmap(blob);

        await this.load_image_bitmap(device, image_data);

        const view_desciptor: GPUTextureViewDescriptor = {
            format: "rgba8unorm",
            dimension: "2d",
            aspect: "all",
            baseMipLevel: 0,
            mipLevelCount: 1,
            baseArrayLayer: 0,
            arrayLayerCount: 1
        };

        this.view = this.textuer.createView(view_desciptor);

        const sampler_discriptor : GPUSamplerDescriptor = {
            addressModeU: "repeat",
            addressModeV: "repeat",
            magFilter: "linear",
            minFilter: "nearest",
            mipmapFilter: "nearest",
            maxAnisotropy: 1
        };

        this.sampler = device.createSampler(sampler_discriptor);
    }

    async load_image_bitmap(device: GPUDevice, image_data: ImageBitmap){
        const texture_descriptor: GPUTextureDescriptor ={
            size: {
                width: image_data.width,
                height: image_data.height
            },
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        };

        this.textuer = device.createTexture(texture_descriptor);

        device.queue.copyExternalImageToTexture(
            {source: image_data},
            {texture: this.textuer},
            texture_descriptor.size
        );
    }
}