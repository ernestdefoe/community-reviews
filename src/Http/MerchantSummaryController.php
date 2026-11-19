<?php

declare(strict_types=1);

namespace ErnestDefoe\CommunityReviews\Http;

use ErnestDefoe\CommunityReviews\Model\Review;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * `GET /api/review-merchants/{id}`: a merchant's average rating and how many reviews tag them, over the
 * reviews the viewer can see (so a gated or held review never leaks into the number). Two aggregates.
 */
class MerchantSummaryController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $parameters = $request->getAttribute('routeParameters');
        $id = (int) (is_array($parameters) ? ($parameters['id'] ?? 0) : 0);

        $query = Review::whereVisibleTo($actor)->where('community_reviews.merchant_id', $id)->where('community_reviews.status', 'approved');
        $count = (clone $query)->count();
        $average = $count > 0 ? round((float) $query->avg('community_reviews.rating'), 2) : null;

        return new JsonResponse(['data' => ['type' => 'review-merchants', 'id' => (string) $id, 'attributes' => ['reviewCount' => $count, 'rating' => $average]]]);
    }
}
