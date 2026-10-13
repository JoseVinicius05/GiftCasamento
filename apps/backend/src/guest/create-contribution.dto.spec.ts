import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContributionDto } from './dto/create-contribution.dto';

describe('CreateContributionDto', () => {
  async function errorsFor(body: Record<string, unknown>) {
    return validate(plainToInstance(CreateContributionDto, body));
  }

  it('aceita valores positivos com até 2 casas', async () => {
    expect(await errorsFor({ amount: 10 })).toHaveLength(0);
    expect(await errorsFor({ amount: 25.5 })).toHaveLength(0);
    expect(await errorsFor({ amount: 0.3 })).toHaveLength(0);
  });

  it('rejeita zero, negativo, 3 casas, texto e ausente', async () => {
    expect(await errorsFor({ amount: 0 })).not.toHaveLength(0);
    expect(await errorsFor({ amount: -5 })).not.toHaveLength(0);
    expect(await errorsFor({ amount: 10.123 })).not.toHaveLength(0);
    expect(await errorsFor({ amount: '10' })).not.toHaveLength(0);
    expect(await errorsFor({})).not.toHaveLength(0);
  });

  it('rejeita valor acima do limite do banco (Decimal 10,2)', async () => {
    expect(await errorsFor({ amount: 100_000_000 })).not.toHaveLength(0);
  });
});
