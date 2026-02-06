export const SwaggerSchemas = {
  User: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      email: { type: "string" },
      displayName: { type: "string" },
      tierId: { type: "string" },
      subscribed: { type: "boolean" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: [
      "id",
      "userId",
      "email",
      "tierId",
      "subscribed",
      "createdAt",
      "updatedAt",
    ],
  },
  Tier: {
    type: "object",
    properties: {
      name: { type: "string" },
      slug: { type: "string" },
      polarRefId: { type: "string" },
      price: { type: "number" },
      description: { type: "string" },
      recurringInterval: { type: "string", enum: ["monthly", "yearly"] },
      features: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            slug: { type: "string" },
            limited: { type: "boolean" },
            maxQuota: { type: "number" },
            recurringInterval: {
              type: "string",
              enum: ["daily", "weekly", "monthly", "yearly", ""],
            },
          },
          required: [
            "name",
            "description",
            "slug",
            "limited",
            "maxQuota",
            "recurringInterval",
          ],
        },
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "name",
      "slug",
      "polarRefId",
      "price",
      "description",
      "recurringInterval",
      "features",
      "createdAt",
      "updatedAt",
    ],
  },
  ApiResponse: {
    type: "object",
    properties: {
      title: { type: "string" },
      message: { type: "string" },
      status: { type: "string", enum: ["success", "error"] },
      data: {
        oneOf: [
          { $ref: "#/components/schemas/User" },
          { $ref: "#/components/schemas/Tier" },
          { type: "array", items: { $ref: "#/components/schemas/Tier" } },
          { type: "null" },
          { type: "object" },
          { type: "array" },
        ],
      },
    },
    required: ["title", "message", "status", "data"],
  },
  ErrorResponse: {
    type: "object",
    properties: {
      title: { type: "string" },
      message: { type: "string" },
      status: { type: "string", enum: ["error"] },
      data: { type: "null" },
    },
    required: ["title", "message", "status", "data"],
  },
  ResumeContent: {
    type: "object",
    additionalProperties: true,
    properties: {
      personalInfo: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          country: { type: "string" },
          summary: { type: "string" },
          jobTitle: { type: "string" },
          links: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["firstName", "lastName", "email"],
      },
      education: {
        type: "array",
        items: {
          type: "object",
          properties: {
            institution: { type: "string" },
            degree: { type: "string" },
            fieldOfStudy: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            current: { type: "boolean" },
            description: { type: "string" },
          },
          required: ["institution", "degree"],
        },
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            company: { type: "string" },
            position: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            current: { type: "boolean" },
            description: { type: "string" },
            location: { type: "string" },
          },
          required: ["company", "position"],
        },
      },
      skills: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            level: {
              type: "string",
              enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
            },
          },
          required: ["name"],
        },
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            link: { type: "string" },
            technologies: { type: "array", items: { type: "string" } },
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
          required: ["title"],
        },
      },
      languages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            level: {
              type: "string",
              enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
            },
          },
        },
      },
      certifications: { type: "array", items: { type: "object" } },
    },
    required: ["personalInfo"],
  },
  Resume: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      title: { type: "string" },
      template: { type: "string" },
      content: { $ref: "#/components/schemas/ResumeContent" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["userId", "title", "content"],
  },
};
