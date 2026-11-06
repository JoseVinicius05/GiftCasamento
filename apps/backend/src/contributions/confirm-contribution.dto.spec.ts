import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmContributionDto } from './dto/confirm-contribution.dto';

describe('ConfirmContributionDto', () => {
  async function errorsFor(body: Record<string, unknown>) {
    return validate(plainToInstance(ConfirmContributionDto, body));
  }

  it('corpo vazio é válido (confirmação normal)', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('aceita acceptExpired true ou false', async () => {
    expect(await errorsFor({ acceptExpired: true })).toHaveLength(0);
    expect(await errorsFor({ acceptExpired: false })).toHaveLength(0);
  });

  it('recusa acceptExpired que não seja booleano (nada de "true" em texto)', async () => {
    for (const acceptExpired of ['true', 1, 0, 'sim', null, {}]) {
      expect(await errorsFor({ acceptExpired })).not.toHaveLength(0);
    }
  });
});
