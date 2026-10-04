package llm

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	antoption "github.com/anthropics/anthropic-sdk-go/option"
	"github.com/openai/openai-go"
	oaioption "github.com/openai/openai-go/option"
)

type Client interface {
	Complete(ctx context.Context, prompt string) (string, error)
}

func NewFromEnv() (Client, error) {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv("LLM_PROVIDER")))

	switch provider {
	case "openai":
		key, err := require("OPENAI_API_KEY")
		if err != nil {
			return nil, err
		}

		model, err := require("OPENAI_MODEL")
		if err != nil {
			return nil, err
		}

		client := openai.NewClient(oaioption.WithAPIKey(key))

		return &openAiClient{
			client: client,
			model:  model,
		}, nil

	case "anthropic":
		key, err := require("ANTHROPIC_API_KEY")
		if err != nil {
			return nil, err
		}

		model, err := require("ANTHROPIC_MODEL")
		if err != nil {
			return nil, err
		}

		client := anthropic.NewClient(antoption.WithAPIKey(key))

		return &anthropicClient{
			client: client,
			model:  model,
		}, nil

	case "custom":
		baseURL, err := require("CUSTOM_BASE_URL")
		if err != nil {
			return nil, err
		}

		model, err := require("CUSTOM_MODEL")
		if err != nil {
			return nil, err
		}

		key, err := require("CUSTOM_KEY")
		if err != nil {
			return nil, err
		}

		client := openai.NewClient(
			oaioption.WithBaseURL(baseURL),
			oaioption.WithAPIKey(key),
		)

		return &openAiClient{
			client: client,
			model:  model,
		}, nil

	default:
		return nil, errors.New("invalid provider: " + provider)
	}
}

func require(name string) (string, error) {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return "", errors.New(name + " is required")
	}
	return v, nil
}

type openAiClient struct {
	client openai.Client
	model  string
}

func (c *openAiClient) Complete(ctx context.Context, prompt string) (string, error) {
	resp, err := c.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.ChatModel(c.model),
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage(prompt),
		},
	})
	if err != nil {
		return "", nil
	}
	if len(resp.Choices) == 0 {
		return "", nil
	}
	return resp.Choices[0].Message.Content, nil
}

type anthropicClient struct {
	client anthropic.Client
	model  string
}

func (c *anthropicClient) Complete(ctx context.Context, prompt string) (string, error) {
	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(c.model),
		MaxTokens: 4096,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(prompt)),
		},
	})
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	for _, block := range resp.Content {
		if block.Type == "text" {
			sb.WriteString(block.Text)
		}
	}
	if sb.Len() == 0 {
		return "", nil
	}
	return sb.String(), nil
}
