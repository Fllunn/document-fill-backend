export interface ITemplate {
  "name": string,                     // Название шаблона
  "filePath": string,                 // Путь к файлу в хранилище
  "variables": string[],              // Список переменных
  "storageType": "system" | "user",   // Тип шаблона
  "userId": string | null,            // Владелец (для пользовательских шаблонов)
  "mimeType": string                  // MIME-тип файла (.docx или .doc)
}