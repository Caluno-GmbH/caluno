import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { FileService } from '../../storage/services/file.service';
import {
  FormBlockField,
  FormBlockFieldDocument,
} from '../models/form-block-field.model';

@Resolver(() => FormBlockField)
export class FormBlockFieldDocumentResolver {
  constructor(private readonly fileService: FileService) {}

  @AllowAnonymous()
  @ResolveField(() => [FormBlockFieldDocument])
  async documents(
    @Parent() field: FormBlockField,
  ): Promise<FormBlockFieldDocument[]> {
    const fileIds = field.documentFileIds ?? [];
    const documents = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const [file, downloadUrl] = await Promise.all([
            this.fileService.findById(fileId),
            this.fileService.resolvePublicUrlForUploadedFile(fileId),
          ]);
          if (!file) return null;
          return {
            fileId,
            filename: file.filename,
            downloadUrl,
          } satisfies FormBlockFieldDocument;
        } catch {
          return null;
        }
      }),
    );
    return documents.filter((d) => d !== null);
  }
}
