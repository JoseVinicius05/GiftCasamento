import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListContributionsQueryDto } from './dto/list-contributions-query.dto';

describe('ListContributionsQueryDto', () => {
  async function errorsFor(query: Record<string, unknown>) {
    return validate(plainToInstance(ListContributionsQueryDto, query));
  }

  it('sem filtro é válido', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('aceita pending, expired e confirmed', async () => {
    for (const status of ['pending', 'expired', 'confirmed']) {
      expect(await errorsFor({ status })).toHaveLength(0);
    }
  });

  it('recusa qualquer outro valor', async () => {
    for (const status of ['', 'PENDING', 'cancelled', 'all', 'x']) {
      expect(await errorsFor({ status })).not.toHaveLength(0);
    }
  });
});
