import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

// Decorator reutilizável: @IsNotPastDate() em qualquer campo de data string
// (formato "YYYY-MM-DD"). Compara só a data, ignorando hora — "hoje" é aceito,
// só datas estritamente anteriores a hoje são rejeitadas.
export function IsNotPastDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotPastDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;

          const inputDate = new Date(`${value}T00:00:00Z`);
          if (Number.isNaN(inputDate.getTime())) return false;

          const now = new Date();
          const todayUTC = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
          );

          return inputDate.getTime() >= todayUTC.getTime();
        },
        defaultMessage(_args: ValidationArguments) {
          return 'A data do evento não pode ser no passado';
        },
      },
    });
  };
}
