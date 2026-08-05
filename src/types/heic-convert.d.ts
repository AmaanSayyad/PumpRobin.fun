declare module "heic-convert" {
  type ConvertInput = {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  function convert(input: ConvertInput): Promise<Buffer>;
  export default convert;
}
