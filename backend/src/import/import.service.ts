import { BadRequestException, Injectable } from '@nestjs/common';
import {
  parseDataset,
  SHEETS,
  type CsvFiles,
  type Dataset,
} from '../data/csv.js';
import { importDataset } from '../data/importer.js';
import {
  datasetFromWorkbook,
  forWorkbook,
  ImportFileError,
} from '../data/spreadsheet.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface UploadedSheet {
  originalname: string;
  buffer: Buffer;
}

// Messages the validator and importer produce about the data itself: safe to show.
const DATA_MESSAGE = /^(classes|users|quizzes|questions)\.csv|^Sheet "/;

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Same path as the command-line importer (`npm run db:import`): validate everything,
   * then import in one transaction. `preview` runs the import and rolls it back.
   */
  async run(files: UploadedSheet[], preview: boolean) {
    const { dataset, source } = await this.read(files);
    try {
      const summary = await importDataset(this.prisma, dataset, {
        dryRun: preview,
      });
      return { preview, source, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!DATA_MESSAGE.test(message)) throw error;
      throw new BadRequestException(
        source === 'xlsx' ? forWorkbook(message) : message,
      );
    }
  }

  private async read(
    files: UploadedSheet[],
  ): Promise<{ dataset: Dataset; source: 'xlsx' | 'csv' }> {
    const usage =
      'Upload one Excel workbook (.xlsx) with the sheets classes, users, quizzes and questions, or the four files classes.csv, users.csv, quizzes.csv and questions.csv.';
    const lower = (file: UploadedSheet) => file.originalname.toLowerCase();

    try {
      if (files.length === 1 && lower(files[0]).endsWith('.xlsx'))
        return {
          dataset: await datasetFromWorkbook(files[0].buffer),
          source: 'xlsx',
        };

      const byName = new Map(files.map((file) => [lower(file), file]));
      if (
        files.length === SHEETS.length &&
        SHEETS.every((name) => byName.has(`${name}.csv`))
      ) {
        const texts = {} as CsvFiles;
        for (const name of SHEETS) {
          try {
            texts[name] = new TextDecoder('utf-8', { fatal: true }).decode(
              byName.get(`${name}.csv`)!.buffer,
            );
          } catch {
            throw new ImportFileError(
              `${name}.csv must be saved as UTF-8 (in Excel: Save As, "CSV UTF-8").`,
            );
          }
        }
        return { dataset: parseDataset(texts), source: 'csv' };
      }
    } catch (error) {
      if (error instanceof ImportFileError)
        throw new BadRequestException(error.message);
      if (error instanceof Error && DATA_MESSAGE.test(error.message))
        throw new BadRequestException(error.message);
      throw error;
    }
    throw new BadRequestException(usage);
  }
}
