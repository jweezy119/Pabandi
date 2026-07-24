type ConversationSignal = {
  phone: string;
  businessId: string;
  userMessage: string;
  agentReply: string;
  createdAt: Date;
};

const memory = new Map<string, ConversationSignal[]>();

export const saveConversationSignal = async (
  phone: string,
  businessId: string,
  userMessage: string,
  agentReply: string
): Promise<void> => {
  const key = `${phone}:${businessId}`;
  const history = memory.get(key) || [];
  history.push({ phone, businessId, userMessage, agentReply, createdAt: new Date() });
  memory.set(key, history.slice(-20));
};
