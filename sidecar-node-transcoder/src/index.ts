import logger from "./logger.js";
import Transcoder from "./transcoder.js";

const command = process.argv[2];

console.log({ argv: process.argv })

async function main() {
  switch (command) {
    case 'transcode':
      const output = process.argv[3]
      const resolutions = Transcoder.parseResolutions(process.argv[4])
      const queue = Transcoder.parseFiles(process.argv[5])

      if (!resolutions || !output || !queue.size) {
        logger.error(`missing required argument(s)`)
        return process.exit(1)
      }
      
      const transcoder = new Transcoder({ resolutions, output, queue })
      await transcoder.process()
      break;
    default:
      logger.error('unknown command '.concat(command))
      process.exit(1);
  }
}

main()