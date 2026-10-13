import { IsNumber, IsPositive, Max } from 'class-validator';

export class CreateContributionDto {
  // Em reais, até 2 casas. As regras de negócio (mínimo de R$ 10 ou o restante,
  // máximo = valor ainda disponível) dependem do estado do presente e são
  // checadas dentro da transação, não aqui.
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Informe um valor válido (até 2 casas decimais)' },
  )
  @IsPositive({ message: 'O valor precisa ser maior que zero' })
  @Max(99_999_999.99, { message: 'Valor muito alto' })
  amount: number;
}
