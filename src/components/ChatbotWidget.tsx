import { useState } from "react";
import { FiMessageCircle, FiX } from "react-icons/fi";

import "./ChatbotWidget.css";

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="chatbot-widget">
      <section
        id="chatbot-panel"
        className="chatbot-panel"
        aria-labelledby="chatbot-title"
        role="dialog"
        aria-modal="false"
        hidden={!isOpen}
      >
        <header className="chatbot-panel-header">
          <div>
            <h2 id="chatbot-title">Chatbot</h2>
            <p>Document Management System</p>
          </div>
          <button
            type="button"
            className="chatbot-close"
            aria-label="Close chatbot"
            onClick={() => setIsOpen(false)}
          >
            <FiX aria-hidden="true" />
          </button>
        </header>
        <div className="chatbot-panel-body">
          <p>
            <b>Chatbot support is not connected yet.</b>
            <br />
            <br />
            <span>
              LLM support requires data preparation, embedding generation,
              vectorization, and storage in a vector database using RAG. The
              standard procedure includes document ingestion, chunking,
              embedding generation, retrieval configuration, LLM integration,
              and testing.
            </span>
          </p>
        </div>
      </section>

      <button
        type="button"
        className="chatbot-launcher"
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
        aria-expanded={isOpen}
        aria-controls="chatbot-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? (
          <FiX aria-hidden="true" />
        ) : (
          <>
            <FiMessageCircle aria-hidden="true" />
            <span>Chatbot</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ChatbotWidget;
