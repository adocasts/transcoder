import logger from "./logger.js";
import Transcoder from "./transcoder.js";

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'transcode':
      let index = 2
      const output = process.argv[++index]
      const useCuid = process.argv[++index] === 'true'
      const includeMp4 = process.argv[++index] === 'true'
      const includeWebp = process.argv[++index] === 'true'
      const prefixSeparator = process.argv[++index]
      const resolutions = Transcoder.parseResolutions(process.argv[++index])
      const queue = Transcoder.parseFiles(process.argv[++index])

      logger.debug(`[running]: ${command} for ${queue.size} files with ${resolutions.join(', ') || 'N/A'} resolutions`)

      if (!output || !queue.size) {
        logger.error(`missing required argument(s)`)
        return process.exit(1)
      }
      
      const transcoder = new Transcoder({ 
        resolutions, 
        output, 
        queue, 
        includeMp4, 
        includeWebp, 
        prefixSeparator,
        useCuid 
      })

      // process.stdin.resume()
      process.stdin.on('data', (data) => {
        logger.debug(`[received]: ${data}`)
        
        if (data.toString() === 'cancel') {
          transcoder.kill()
          process.exit(0)
        }
      })

      await transcoder.process()

      process.exit(0)
      break;
    default:
      logger.error('unknown command '.concat(command))
      process.exit(1);
  }
}

main()
