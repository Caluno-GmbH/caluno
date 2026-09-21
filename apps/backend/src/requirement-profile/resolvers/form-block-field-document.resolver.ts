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
    const files = await this.fileService.findByIds(fileIds);
    const documents = files.map((file) => {
      try {
        const downloadUrl = this.fileService.resolvePublicUrlForFile(file);
        return {
          fileId: file.id,
          filename: file.filename,
          downloadUrl,
        } satisfies FormBlockFieldDocument;
      } catch {
        return null;
      }
    });

    return documents.filter((d) => d !== null);
  }
}
