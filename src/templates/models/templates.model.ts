import { MongooseModule } from '@nestjs/mongoose';
import { TemplatesSchema } from '../schemas/templates.schema';

let TemplatesModel = MongooseModule.forFeature([
  { name: 'Templates', schema: TemplatesSchema, collection: 'templates' },
]);
export default TemplatesModel;