import {
  Controller,
  Header,
  HttpCode,
  ParseBoolPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/auth.decorators.js';
import { ImportService, type UploadedSheet } from './import.service.js';

/**
 * Load the centre's spreadsheets from the browser. The command-line importer
 * (`npm run db:import`) stays available and uses the same validation and import.
 */
@Controller('import')
@Roles('ADMIN')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FilesInterceptor('files', 4, {
      // Kept in memory (no disk writes). Same 5 MB per-file limit as the command-line importer.
      limits: { fileSize: 5_000_000, files: 4 },
    }),
  )
  run(
    @UploadedFiles() files: UploadedSheet[] | undefined,
    @Query('preview', new ParseBoolPipe({ optional: true })) preview?: boolean,
  ) {
    return this.imports.run(files ?? [], preview ?? false);
  }
}
